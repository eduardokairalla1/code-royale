# Code Royale backend

The game server. It keeps the rooms in Redis, runs rounds, sends player
code to [Piston](https://github.com/engineer-man/piston) and ranks the
results. Browsers talk to it over http and Socket.IO, all under `/api`.

Every instance shares the same Redis, so you can run as many as you
need behind a load balancer. No sticky sessions: the frontend only
uses websockets.

Stack: Node 24, TypeScript, Fastify, Socket.IO, Redis, Zod, Vitest.

## Running it

```bash
# Piston on 127.0.0.1:2000 and Redis on 127.0.0.1:6379, see ../deploy/README.md
cd ../deploy && docker compose -f docker-compose.yaml -f docker-compose-dev.yaml up -d

cd ../backend
cp .env.example .env
npm install
npm run dev          # http://localhost:3000/api/health
```

| Script | What it does |
|---|---|
| `npm run dev` | server with reload on save |
| `npm run build` | compile to `dist/` |
| `npm start` | run `dist/` |
| `npm run typecheck` | typecheck the app and the tests |
| `npm test` | unit and integration tests |

The tests need Redis, on `REDIS_URL` or `redis://localhost:6379`. Each
test uses keys of its own and deletes them after.
`PISTON_URL=http://localhost:2000 npm test` also runs every language
against a real Piston.

## Settings

Read from the env or `.env`. Only `REDIS_URL` is required.

| Env var | Default | What it does |
|---|---|---|
| `REDIS_URL` | required | rooms, rounds and timers, e.g. `redis://localhost:6379` |
| `REDIS_KEY_PREFIX` | `code-royale:` | put before every key and channel |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | where it listens |
| `CORS_ORIGIN` | `http://localhost:5173` | frontend origins, comma separated |
| `PISTON_URL` | `http://localhost:2000` | the code runner |
| `CHALLENGES_DIR` | `./challenges` | where the challenges are read from |
| `ENABLED_LANGUAGES` | all | language ids players can pick |
| `LSP_SECRET` | unset | shared with the lsp service; unset turns autocomplete off |
| `MAX_PLAYERS_PER_ROOM` / `MAX_ROOMS` | `20` / `1000` | room limits |
| `MAX_CODE_LENGTH` | `64000` | characters per program |
| `MAX_CONCURRENT_RUNS` | `16` | example runs at once, across all rooms and instances |
| `EMPTY_ROOM_TTL_SECONDS` | `60` | how long an empty room lives |
| `RECONNECT_GRACE_SECONDS` | `10` | how long a dropped player keeps their seat |
| `LOG_LEVEL` | `debug` | lowest level logged; `info` hides draft saves |

## Logs

JSON on stdout, one line per event, each with `event` (its name, also in
`msg`), `service`, `version` and `commit`. Filter on `event`; follow a
room by `room_code` and a player by `player_id`.

| Event | When | Key fields |
|---|---|---|
| `started` / `stopped` | the server is up / stops | settings / `signal` |
| `request` | an http request is answered, the health check aside | `route`, `status` |
| `command` | a socket command is answered | `command`, `socket_id` |
| `socket_connected` | a player's socket is accepted | `replaced_socket_id` |
| `socket` | a socket closes | `reason`, `closed_by`, `commands`, `limited` |
| `socket_refused` | a socket fails its handshake | `error` |
| `rate_limited` | a socket goes over its rate, once per flood | `command` |
| `room_created` / `room_deleted` | a room starts / goes | `reason`, `age_ms`, `rounds` |
| `player_joined` / `player_left` | a player comes / goes | `reason`, `players` |
| `host_changed` | the host left | `from`, `to` |
| `round_started` / `round_finished` | a round starts / ends | `challenge_id`, `reason`, how many submitted |
| `round_restarted` | the host goes back to the lobby | |
| `examples_run` / `submission_judged` | code ran against the examples / the tests | `language`, `statuses`, `executor_ms` |
| `ticket_issued` | a player gets an lsp ticket | `ticket_id`, also in the lsp logs |
| `timer_failed` / `round_finish_failed` | background work failed | `kind`, `error` |
| `redis_down` / `redis_up` | a connection to Redis is lost / back | `client`, `error` |

Work that takes time carries `duration_ms` and `outcome` (`ok` or
`error`); failures add `error` (a slug) and `details`, or `err` with the
stack for a bug. Tokens, tickets and player code never reach the logs.

Levels: `ERROR` when something broke (Piston or Redis down, a bug); `WARN` when a
client did something it should not (a bad token, a full room, a flood);
`INFO` otherwise; `DEBUG` for draft saves, sent while players type.

## State

Everything lives in Redis, under `REDIS_KEY_PREFIX`:

| Key | What it holds |
|---|---|
| `room:<code>` | the room as json; its round keeps the challenge id |
| `rooms` | every room code, to count them for `MAX_ROOMS` |
| `drafts:<code>:<round start>` | each player's latest code, a hash |
| `schedule` | timers: round end, empty room, reconnect grace |
| `runs` | example runs going on, for `MAX_CONCURRENT_RUNS` |
| `lock:run:<player>` / `lock:finish:<code>` | one run per player, one instance closing a round |

A room changes only through a compare and set, retried when two
instances change it at once. Every saved change bumps its `version`, so
clients drop states that arrive late.

Timers are polled by every instance and run by whichever claims them
first. A claimed timer whose instance dies runs again elsewhere after a
few minutes. When a round ends, submissions still not judged, because
their instance died, are judged again from the stored code.

Keys expire 24 hours after their last change, in case nothing deletes
them. Removing a challenge file breaks the rooms playing it.

## Challenges

One json file per challenge in `challenges/`, loaded on boot. A broken
file stops the server, and the error names it.

```json
{
  "id": "sum",
  "title": "Sum of two numbers",
  "description": "Read A and B and print A + B.\n\nConstraints: |A|, |B| <= 10^9",
  "difficulty": "easy",
  "timeLimitSeconds": 300,
  "examples": [{ "input": "2 5", "output": "7" }],
  "tests": [{ "input": "-5 2", "output": "-3" }]
}
```

Players see the examples. The tests stay on the server and decide the
score. Outputs are compared after trimming trailing spaces and newlines.
Keep each test's input under about 30 KB: Piston refuses bigger requests.

## Code

```
src/
├── server.ts, app.ts, socket.ts, config.ts
├── shared/              # errors, logging, ids, validation, scheduler
│   └── redis/           # connections, locks, slots
└── modules/
    ├── room/            # create, join, presence, host hand-over, store
    ├── game/            # rounds, timer, ranking
    ├── challenge/       # loads and picks challenges
    ├── submission/      # example runs, drafts, judging
    ├── executor/        # the Piston client
    ├── language/        # the language catalog
    ├── lsp/             # tickets for the lsp service
    └── system/          # health check
tests/                   # unit, integration (on Redis), piston
```

Code style: [docs/code-guidelines.md](../docs/code-guidelines.md).
