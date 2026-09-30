# Code Royale lsp service

Autocomplete for the game's editor. Each editor connects over a websocket
and gets its own language server (pyright, gopls, clangd...) running here.

Stack: Go, with the official language server of each language in the Docker image (about 3 GB).

## How a session works

1. The frontend asks the backend for a ticket. Only players in a running
   round get one. It is signed with `LSP_SECRET`, lasts 60 seconds and
   works once.
2. The editor connects to `/lsp/ws?ticket=...`. The service checks the
   ticket and the session limits without calling the backend.
3. The service creates a fresh folder with what the language needs (e.g.
   `go.mod`) and starts the server there, with a clean env.
4. The session ends when the player leaves, the round ends or nobody types
   for `IDLE_TIMEOUT_SECONDS`. The service then kills the server and
   deletes the folder.

Close codes: `4001` refused ticket, `4003` service full, `4004` player
limit, `4008` idle, `4009` round over.

## Security

Language servers can be tricked into running commands, and the websocket
carries whatever a client sends. So the service:

- forwards only the editor's own requests (open, change, completion,
  hover, signature help) and drops the rest, `workspace/executeCommand`
  included;
- replaces the options and paths in `initialize` with its own;
- answers the server's `workspace/configuration` requests itself;
- drops any document outside `file:///workspace/`;
- runs each server as its own user, so it can't read the service's secret
  or another session. The container runs as root only for that, with
  every other capability dropped.

The filters are in `internal/session/` (`filter.go`, `initialize.go`,
`reply.go`). In production, also keep it on a network with no internet
access, reachable only by the proxy.

## Languages

| Language | Server |
|---|---|
| Python | pyright |
| JavaScript, TypeScript | typescript-language-server |
| Go | gopls |
| C, C++ | clangd |
| Rust | rust-analyzer |
| Java | jdtls |

## Running it

In Docker, from `deploy/`:

```bash
CORS_ORIGIN=http://localhost:5173 docker compose up -d lsp
curl -s localhost:3001/lsp/health
```

Or on the host, with Go and whichever servers are on the `PATH`:

```bash
LSP_SECRET=$(openssl rand -hex 32) go run .
go test ./...
```

The backend needs the same `LSP_SECRET`, and the frontend
`VITE_LSP_URL=ws://localhost:3001`.

| Env var | Default | What it does |
|---|---|---|
| `LSP_SECRET` | required | shared with the backend, 32+ characters |
| `PORT` / `HOST` | `3001` / `0.0.0.0` | where it listens |
| `CORS_ORIGIN` | `http://localhost:5173` | origins browsers connect from |
| `MAX_SESSIONS` | `16` | servers at once; each takes 100 to 700 MB |
| `MAX_SESSIONS_PER_PLAYER` | `2` | servers per player |
| `IDLE_TIMEOUT_SECONDS` | `600` | ends sessions nobody types in |
| `SESSION_UID_BASE` | `20000` | first uid sessions run as, when root |
| `ENABLED_LANGUAGES` | all | language ids |
| `LOG_LEVEL` | `info` | `debug` also logs the servers' stderr, see [Logs](#logs) |

## Logs

JSON on stdout, one line per event, each with `event` (its name, also in
`msg`), `service`, `version` and `commit`. Filter on `event`.

| Event | When | Key fields |
|---|---|---|
| `started` | the service is up | settings, `isolated` |
| `session_started` | a session takes its slot | who, language, `active_sessions` |
| `session` | a connection ends, whatever happened | see below |
| `stopped` | the service stops | `uptime_s`, `sessions_ended` |
| `server_stderr` | a language server writes to stderr, with `LOG_LEVEL=debug` | `session_id`, `line` |

`session` is the summary a connection leaves; refusals only get this
one:

- `outcome`: `refused`, `failed` (never got ready, with `setup_step`:
  `workspace`, `server` or `ready`) or `ended`;
- `reason`: why, from a fixed set, e.g. `bad_ticket`, `spent_ticket`,
  `busy`, `round_over`, `idle`, `client_left`, `message_too_big`,
  `server_exited`, `server_protocol_error`, `panic`, `shutdown`;
- `session_id`, `ticket_id` (the same id the backend signed), `player_id`,
  `language`;
- `duration_ms`, `setup_ms`, `first_reply_ms` (when the server became
  useful), `stop_ms` (how long cleaning up took);
- messages in, out and dropped; `drops` by why (`method`, `document`,
  `response`, `malformed`), `dropped_methods`, `server_request_methods`;
- `slot`, `active_sessions`, `max_sessions`, `close_code`,
  `leftover_processes` (still alive after the server stopped), and
  `server_exit` or `error` when something broke.

Levels: `ERROR` when something broke (a failed setup, a server that died
or broke the protocol, a panic); `WARN` when the client did what an editor
never does (a file outside the workspace, a message over the limit);
`INFO` otherwise. A panic ends only its session, never the service, and
its line carries the `stack`.

## Code

```
main.go                  # boot and shutdown
internal/
├── config/
│   ├── config.go        # the settings and Load
│   └── env.go           # reading and validating env vars
├── ticket/ticket.go     # ticket verification
├── ledger/              # spent tickets: the interface, and in memory
├── languages/
│   ├── language.go      # what a language is
│   └── catalog.go       # the languages: command and workspace files
├── jsonrpc/framing.go   # stdio message framing
├── logging/
│   ├── logger.go        # the one JSON logger
│   ├── events.go        # every event, typed, and Log
│   └── lifecycle.go     # started, stopped
├── recovery/            # panics turned into errors, for the logs
├── server/
│   ├── server.go        # Server and routes
│   ├── health.go        # GET /lsp/health: ok, nothing more
│   ├── connect.go       # GET /lsp/ws: accept, limit, run a session
│   ├── authorize.go     # ticket, ledger, language
│   ├── event.go         # the session log line
│   └── limiter.go       # sessions in total and per player
└── session/
    ├── session.go       # Run: a session from start to end
    ├── stats.go         # what a session saw, for its log line
    ├── reason.go        # why a session ended
    ├── recover.go       # a goroutine's panic ends its session only
    ├── language_server.go  # the server process and its clean env
    ├── relay.go         # messages both ways
    ├── liveness.go      # idle timeout and pings
    ├── message.go       # a JSON-RPC message
    ├── filter.go        # what the editor may send
    ├── initialize.go    # rewriting initialize
    ├── reply.go         # answering the server's requests
    ├── workspace.go     # the session folder and its paths
    └── isolation_*.go   # own user and process cleanup, linux only
```

A new language needs an entry in `internal/languages/catalog.go`, its server
in the `Dockerfile`, and the same id in the backend and frontend catalogs.
