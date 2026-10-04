# Code Royale frontend

The game's pages, drawn like a notebook. It talks to the backend over http
and Socket.IO, and to the lsp service for autocomplete.

Stack: React, TypeScript, Vite, Monaco, rough.js, Motion, Radix, CSS
Modules, Vitest.

## Running it

The backend has to be running. See [backend/README.md](../backend/README.md).

```bash
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm run build` | typecheck and bundle into `dist/` |
| `npm run typecheck` | typecheck the app and the tests |
| `npm run lint` | eslint |
| `npm test` | unit tests |

## Settings

Read at build time, so changing one means rebuilding.

| Env var | Default | What it does |
|---|---|---|
| `VITE_API_URL` | the page's origin | the backend's origin, e.g. `http://localhost:3000` |
| `VITE_LSP_URL` | the page's origin | the lsp service's origin, e.g. `ws://localhost:3001`; `off` turns autocomplete off |

The frontend adds `/api` and `/lsp` itself. With both unset it expects a
proxy on the same origin, which is how the published image is built.

## Code

```
src/
├── main.tsx, app.tsx    # entry and routes: / and /game/:code
├── config.ts            # the env vars above
├── styles/              # design tokens
├── shared/              # http client, errors, storage, sketch helpers
├── components/          # the hand-drawn kit, built on SketchFrame
└── modules/
    ├── home/            # name, create or join a room
    ├── room/            # connection, lobby, invite
    ├── game/            # round, editor, results; lsp/ for autocomplete
    └── language/        # language picker
```

The room page switches screens (lobby, round, results) on each state the
server sends. The editor's code is saved in the browser and synced to the
server, which submits it when time runs out.

`Dockerfile` builds the bundle and serves it with nginx on port 8080.

Code style: [docs/code-guidelines.md](../docs/code-guidelines.md). UI text
is in English.
