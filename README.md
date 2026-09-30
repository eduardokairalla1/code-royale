![Code Royale](docs/banner.svg)

# Code Royale

A multiplayer coding game. I made it because my friends and I wanted a
good coding game to play in our spare time.

## How it works

```
browser ──http, Socket.IO──▶ backend ──▶ Piston (runs the code)
        ──websocket────────▶ lsp service (autocomplete)
```

| Part | What it is | Stack |
|---|---|---|
| [frontend](frontend/) | the game's pages | React, TypeScript, Vite, Monaco |
| [backend](backend/) | rooms, rounds, judging | Node, TypeScript, Fastify, Socket.IO |
| [lsp](lsp/) | a language server per editor | Go |
| [deploy](deploy/) | Docker Compose for the whole thing | Docker, Piston |

Player code runs in [Piston](https://github.com/engineer-man/piston), self hosted.

## Running it

You need Docker with Compose v2 and about 12 GB of disk.

```bash
cd deploy
cp .env.example .env     # set LSP_SECRET: openssl rand -hex 32
docker compose up -d --build
```

The first start takes a few minutes while Piston installs the languages.
Then open http://localhost:8080.

To work on the code, run Piston in Docker and the services on your
machine. [deploy/README.md](deploy/README.md#development) has the steps,
and each part's README covers its own settings.

## Repository

```
backend/       # game server; challenges/ holds the challenge files
frontend/      # web client
lsp/           # language server service
deploy/        # compose files and Piston config
docs/          # code guidelines
.github/       # CI: tests, and images for Docker Hub
VERSION        # release version, used in the image tags
```

## Adding a challenge

Add a json file to `backend/challenges/` with a statement, examples and
hidden tests. The format is in
[backend/README.md](backend/README.md#challenges).

## Tests

```bash
cd backend && npm test
cd frontend && npm test
cd lsp && go test ./...
```

CI runs them on every push and pull request.

## License

[MIT](LICENSE)
