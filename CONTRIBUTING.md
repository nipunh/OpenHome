# Contributing

Thanks for considering a contribution. The project is early and APIs may change; please open an issue before large changes.

## Ways to contribute

- Reproduce and document an installation issue
- Add hardware or OS compatibility test results
- Improve setup and troubleshooting documentation
- Add API tests or MQTT fixtures
- Implement a device capability or room-management feature
- Improve accessibility and mobile UI

## Development setup

Requirements: Node.js 22+, pnpm, and optionally Docker Compose.

```sh
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm install
pnpm --filter @openhome/api typecheck
pnpm --filter @openhome/api test
```

## Pull request expectations

- Keep PRs focused and explain the user impact.
- Add or update tests for behaviour changes.
- Do not include real device identifiers, network keys, coordinator backups, logs with secrets, or `.env` files.
- Update documentation and the supported-hardware matrix when changing setup or hardware behaviour.
- Avoid breaking API changes unless discussed first.

## Commit and review

Use clear, imperative commit messages. Maintainers may ask for changes, tests, or a reproducible issue description before merging.
