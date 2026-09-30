# Code guidelines

Rules every file in the project follows.

## General rules

- **Code 100% in English**: names, comments, log and error messages.
- **At most 80 columns** per line. Break long imports, signatures and
  chained calls.
- **Always single quotes** (`'...'`) in strings and imports. Double quotes
  only show up as text inside a string.
- **Names say the purpose, not the library.** `formatValidationErrors`, not
  `formatZodIssues`. The library shows up in the type and the import, never
  in the name.

## File layout

Every file starts with a one line header and is split into sections, in this
order:

| Section | What goes in it |
|---|---|
| `// --- IMPORTS ---` | one import per line, sorted by `from` |
| `// --- GLOBALS ---` | constants, Zod schemas, module state |
| `// --- CODE ---` | types, interfaces, classes and functions |
| `// --- EXPORTS ---` | special cases only: re-exports and aliases |

- An empty section is left out.
- One blank line between sections.
- **Inline `export` by default**, right on the declaration (`export
  function`, `export class`, `export interface`...).
- The `EXPORTS` section only exists when a declaration cannot be exported in
  place: re-exporting from another module (`export { x } from "./x.js"`) or
  exporting under another name (`export { a as b }`).

```ts
/**
 * Room rules: create, join and look up rooms.
 */

// --- IMPORTS ---
import { generateRoomCode } from '../../shared/ids.js';
import type { RoomStore } from './room.store.js';

// --- GLOBALS ---
const MAX_PLAYERS_PER_ROOM = 20;

// --- CODE ---
/**
 * Room rules, shared by the http routes and the socket handlers.
 */
export class RoomService {
  // ...
}
```

## Imports

- **One import per line**, even from the same module.
- **Sorted by `from`**, in a single list, with no blank lines between
  groups. Imports from the same module are sorted by name.
- `import` and `import type` follow the same order.

```ts
// --- IMPORTS ---
import { generatePlayerId } from '../../shared/ids.js';
import { generateRoomCode } from '../../shared/ids.js';
import { RoomFullError } from './room.errors.js';
import type { RoomStore } from './room.store.js';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
```

Avoid:

```ts
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
```

## Docstrings

Every function and method has a **short, direct** JSDoc, constructors,
getters and interface methods included.

- One sentence, on a single line, saying what it does.
- `@param {Type} name Description.` for each parameter.
- `@returns {Type} Description.` (use `@returns {void}` / `{Promise<void>}`
  when it returns nothing).
- `@throws {ErrorClass} When ...` when it throws an application error.
- Continuation lines aligned with the start of the description.

```ts
/**
 * Add a new player to an existing room.
 *
 * @param {string} code The room code.
 * @param {string} name The player's name.
 *
 * @returns {Promise<JoinResult>} The room and the new player.
 *
 * @throws {RoomFullError} When the room reached the player limit.
 */
```

Types, interfaces and classes get a one sentence description, no tags.

## Function bodies

- **One blank line right after the `{`** that opens a function, except in
  one line functions (getters, a plain `return`).
- **Short, direct comments, all lowercase**, explaining the block right
  below. **One line at most**: whatever does not fit goes to the README.
- The comment of a `catch` goes on the line before `} catch`.

```ts
async function start(): Promise<void> {

  const app = buildApp();

  // start the server
  try {
    await app.listen({ port: config.port, host: config.host });

  // errors occurred while starting the server: log them and exit the process
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}
```

## Folders (backend)

Organized by **domain** (a modular monolith), not by file type:

```
src/
├── server.ts        # starts the server
├── app.ts           # builds Fastify and registers the modules
├── config.ts        # env vars validated with Zod
├── shared/          # code used by several modules
└── modules/
    └── <domain>/
        ├── <domain>.types.ts
        ├── <domain>.errors.ts
        ├── <domain>.service.ts   # business rules
        ├── <domain>.utils.ts     # pure helpers of the domain
        ├── <domain>.routes.ts    # http (thin layer)
        └── <domain>.socket.ts    # socket.io (thin layer)
```

- **Business rules live in the `service`.** Routes and socket handlers only
  validate the input and call the service.
- **Interfaces only where the implementation will change** (e.g.
  `RoomStore`, `CodeExecutor`).
- **Folders are created when needed.** No empty folder "for later".
- `backend/` and `frontend/` are independent projects, with no shared code.

## Validation

- Every external input (body, params, socket events, env vars) is validated
  with **Zod**.
- Schemas live in `GLOBALS` and are checked with `parseInput`
  (`src/shared/validation.ts`), never with a direct `.parse()`:

  ```ts
  const { name } = parseInput(nameBodySchema, request.body);
  ```

- `parseInput` throws `RequestValidationError` (an `AppError`), which becomes
  a `400` with the list of invalid fields. Only `validation.ts` knows how Zod
  reports errors.

## Errors

Each error is a class that extends `AppError` and declares how it is
answered and logged:

```ts
/**
 * Raised when no room matches the given code.
 */
class RoomNotFoundError extends AppError {
  static override readonly MESSAGE = 'Room not found!';
  static override readonly STATUS_CODE = 404;
  static override readonly LOG_LEVEL = 'warn';
}

throw new RoomNotFoundError({ code });  // details only go to the logs
```

- A domain's errors live in `<domain>.errors.ts`.
- The response's `error` is the slug of the class name
  (`RoomNotFoundError` → `room_not_found_error`).
- The details passed to the constructor go **to the logs only**, never to
  the client.
- An error that must send the client more than its `MESSAGE` overrides the
  `responseMessage` getter (e.g. `RequestValidationError` sends the list of
  invalid fields).

Response format:

| Case | Status | Body |
|---|---|---|
| `AppError` | from the class | `{ "error": "<slug>", "message": "<MESSAGE>" }` |
| `RequestValidationError` | 400 | `{ "error": "request_validation_error", "message": ["field: reason", ...] }` |
| Fastify http error / unknown route | 4xx | `{ "error": "http_error", "message": "..." }` |
| Anything else | 500 | `{ "error": "internal_error", "message": "Internal Server Error!" }` |

## Config

- Every env var is declared in a Zod schema in `src/config.ts`, with its type
  and default. An invalid env stops the server on boot.
- New variables also go into `.env.example`.
