# Contributing to Code Royale

Thanks for wanting to help! New challenges, bug fixes and ideas are all
welcome.

## Before you start

- **Small fixes and new challenges:** open a pull request straight away.
- **Bigger changes** (a new feature, a new service, a different way of
  doing something): open an issue first, so we can agree on the idea
  before you spend time on the code.
- **Security issues:** don't open an issue, see [SECURITY.md](SECURITY.md).

## Setting up

You need Docker with Compose v2, Node 24 and, for the lsp service, Go 1.27.

Piston and Redis run in Docker; the backend and the frontend run on your
machine. [deploy/README.md](deploy/README.md#development) has the steps,
and each part's README covers its own settings:

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)
- [lsp/README.md](lsp/README.md)

## Adding a challenge

The easiest way to contribute.

1. Add a json file to `backend/challenges/`, numbered after the last one,
   e.g. `034-word-count.json`. The format is in
   [backend/README.md](backend/README.md#challenges).
2. Pick the `difficulty` honestly: `easy`, `medium` or `hard`. Hosts filter
   rounds by it.
3. Give it at least one example and enough hidden tests to catch wrong
   answers: edge cases, empty or large inputs, negative numbers.
4. Solve it yourself in the game, in at least one language, to check the
   statement and the outputs match.
5. Run the backend tests: they load the whole catalog and fail on a broken
   file.

## Writing code

Every file follows [docs/code-guidelines.md](docs/code-guidelines.md):
English only, 80 columns, one import per line, a docstring on every
function. Read it before your first change; reviews point back to it.

Before opening a pull request, run the checks of every part you touched.
The backend and lsp tests need Redis on `127.0.0.1:6379` (the dev overlay
starts it):

```bash
cd backend && npm run typecheck && npm test
cd frontend && npm run typecheck && npm run lint && npm test
cd lsp && go vet ./... && go test ./...
```

New behavior comes with tests.

## Using AI

AI tools are very welcome here. In fact, I used AI myself, and still do,
to help me build many parts of this project. They are great for exploring
the codebase, learning something new and getting unstuck. They help you
develop, they don't replace you, and vibe coded pull requests won't be
merged.

If AI wrote part of your change:

- **Understand all of it.** You should be able to explain every line: what
  it does and why it is there. If you can't, it isn't ready to open.
- **Review it deeply before anyone else does**, the way you would review a
  stranger's code. Run it, test it, read it again.
- **Simplify it.** AI tends to write code far more complex than the
  problem needs: extra layers, options nobody asked for, checks for cases
  that can't happen. That code is hard to understand and hard to maintain.
  Cut it down to what the change really needs.
- **Make it follow the project.** The [code guidelines](docs/code-guidelines.md)
  and the commit rules below apply to generated code too.

You are the author of what you submit, whoever typed it.

## Commits

Commits are atomic. If the idea is new to you,
[this article](https://dev.to/samuelfaure/how-atomic-git-commits-dramatically-increased-my-productivity-and-will-increase-yours-too-4a84)
explains it well.

- One change per commit, and every commit leaves the code working.
- Messages in English, in the imperative, at most 50 characters, no
  prefix and no period: `Add a timer to the lobby`, not
  `feat: added timer.`
- Say what changes for the game, not which function changed.
- A body only when the why isn't obvious from the code.

## Versions

Each part has its own version, and the project has one for the release:

| What | Where |
|---|---|
| backend | `backend/package.json` |
| frontend | `frontend/package.json` |
| lsp | `lsp/VERSION` |
| the project | `VERSION`, used in the image tags |

A pull request bumps the parts it changed: minor for features, patch for
fixes. Each bump is its own commit, at the end of that part's commits, and
the project's bump is the last commit of all. For package.json, use
`npm version <x.y.z> --no-git-tag-version` so the lockfile follows.

## Pull requests

- Fill in the template: what changes, and how you tested it.
- CI runs every part's tests and builds the images; it has to pass.
- Keep it to one feature or fix. Unrelated cleanups go in their own
  pull request.

## License

By contributing, you agree your work is released under the
[MIT License](LICENSE).
