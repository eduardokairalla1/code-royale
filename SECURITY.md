# Security

Code Royale runs code written by anyone who joins a room, so security
reports are very welcome.

## Reporting a vulnerability

Please **don't open a public issue**. Report it privately on GitHub
instead:
[Report a vulnerability](https://github.com/eduardokairalla1/code-royale/security/advisories/new).

Include what you found, how to reproduce it, and what an attacker could
do with it. A proof of concept helps, but keep it harmless: don't attack
[coderoyale.app](https://coderoyale.app) or its players, and don't keep
any data you get to.

This is a side project, so answers are best effort: I'll acknowledge the
report within a week and keep you posted until it's fixed. Once it is,
you'll get credit in the advisory, if you want it.

## Supported versions

Only the latest release, the one running at
[coderoyale.app](https://coderoyale.app), gets fixes.

## What's in scope

- Escaping the code sandbox or reaching the network from player code.
- Getting the lsp service to run commands, read files or reach another
  session ([lsp/README.md](lsp/README.md#security) lists its defenses).
- Reading the hidden tests of a challenge before the round ends.
- Taking over another player's seat, or acting as the host without
  being it.
- Reaching Piston, Redis or the lsp service directly from the internet
  with the [deploy setup](deploy/README.md#security).

## Out of scope

- Bugs in [Piston](https://github.com/engineer-man/piston) itself: report
  them upstream, and tell me too if they affect Code Royale.
- Flooding the server with traffic. Rate limits exist, but volume attacks
  are not something a side project can defend against.
- Instances run by other people with a different setup.
