# Code Royale with Docker Compose

Runs the whole game on one machine: frontend, backend, the lsp service,
Redis, and
[Piston](https://github.com/engineer-man/piston), which runs player code.

Every image is built from the source in this repo.

Images built from `main` are also published on Docker Hub as
`edu3983/code-royale:<service>-<version>-<commit>`, e.g.
`backend-0.1.0-abc1234`.

## Requirements

- Docker with Compose v2.
- cgroup v2.
- About 12 GB of disk, mostly Piston's languages and the lsp image.
- 100 to 700 MB of memory per player with autocomplete on.

Piston only ships `linux/amd64` images. They work on Apple Silicon under
emulation, just slower.

## Running it

```bash
cp .env.example .env     # set LSP_SECRET: openssl rand -hex 32
docker compose up -d --build
docker compose logs -f piston-packages   # first run installs languages, ~3 min
```

The game is on http://localhost:8080. The backend is on `:3000` and the
lsp service on `:3001`. Piston has no published port.

Health checks:

```bash
curl -s localhost:3000/api/health
curl -s localhost:3001/lsp/health
```

## Development

The dev overlay runs only Piston, on `127.0.0.1:2000`. You run the other
services on your machine and point the frontend at them.

```bash
docker compose -f docker-compose.yaml -f docker-compose-dev.yaml up -d

cd ../backend && npm run dev             # :3000
cd ../frontend && VITE_API_URL=http://localhost:3000 VITE_LSP_URL=off \
  npm run dev                            # :5173
```

For autocomplete, start the lsp service too and give the backend the same
`LSP_SECRET`:

```bash
CORS_ORIGIN=http://localhost:5173 docker compose up -d lsp
```

Then run the frontend with `VITE_LSP_URL=ws://localhost:3001`. Compose
reads `LSP_SECRET` from `.env` even in dev.

## Security

Piston runs player code in a privileged container and has no
authentication. Never publish its port. In production, put it and the
lsp service on networks with `internal: true`, so they have no internet
access, and install Piston's packages in a separate compose project. The
lsp service runs untrusted input too; see
[lsp/README.md](../lsp/README.md#security).

## Languages

Installed from [configs/piston/packages.txt](configs/piston/packages.txt):
Python 3.12, JavaScript (Node 20), TypeScript 5.0, Go 1.16, Java 15, C and
C++ (GCC 10) and Rust 1.68.

To add one, add it to `packages.txt` and run `docker compose up -d`.
`ENABLED_LANGUAGES` in `.env` narrows what players can pick. C# and
Kotlin are left out because they took 5 to 9 seconds per run.

## Challenges

The backend reads `../backend/challenges` from the host, so after editing a
challenge you only need `docker compose restart backend`. The format is in
[backend/README.md](../backend/README.md#challenges).
