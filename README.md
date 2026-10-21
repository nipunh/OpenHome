# OpenHome (working name)

An open-source, local-first smart-home interface for Zigbee devices. The project aims to provide a friendly home dashboard, room organisation, and device controls using established open-source components.

> **Status: early scaffold / not production-ready yet.** This repository is a starting point for development. Platform support, installer behaviour, security hardening, and hardware combinations must be tested before a stable release.

## Current scope

- Home dashboard and room/device organisation
- Device discovery through Zigbee2MQTT
- On/off and brightness controls where the device supports them
- Live state updates
- Local-first operation

Not in the initial scope: scenes, automations, schedules, voice assistants, remote cloud access.

## Architecture

- `apps/ios/` — planned React Native + Expo client
- `services/api/` — TypeScript API and MQTT adapter
- `packages/contracts/` — shared API contracts and types
- `deploy/` — Mosquitto and Zigbee2MQTT deployment configuration
- `scripts/` — developer and diagnostic utilities
- `docs/` — installation, hardware support, architecture, and contribution docs

Mosquitto and Zigbee2MQTT remain upstream dependencies. OpenHome should not require an IKEA hub. Device compatibility depends on Zigbee2MQTT and the device itself.

## Prerequisites

- Node.js 22 LTS or another version explicitly supported by the project's CI
- pnpm (Corepack is recommended where supported)
- Docker Engine + Docker Compose plugin for the container path
- A Zigbee coordinator with supported coordinator firmware
- For native deployment, install Mosquitto and Zigbee2MQTT using their official documentation

## Development quick start

```bash
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm install
pnpm --filter @openhome/api dev
```

The API listens on `http://127.0.0.1:3000` by default. Check `GET /health`.

The API currently provides a minimal health endpoint and MQTT integration foundation; device API routes and controls are planned work.

## Container deployment

1. Copy `.env.example` to `.env` and review every setting.
2. Set `ZIGBEE_SERIAL_PORT` to the serial device path visible to the container runtime.
3. Review `deploy/zigbee2mqtt/configuration.yaml` and make sure the adapter matches your coordinator.
4. Start services:

```bash
docker compose up -d --build
```

USB/serial passthrough differs across Linux, macOS, and Windows. On macOS and Windows, Docker Desktop may not expose a directly attached USB serial device to Linux containers. Do not assume the container deployment will work with every host/coordinator combination; use the native Zigbee2MQTT path where necessary. See [installation docs](docs/installation.md).

**Security:** this is a local-network development scaffold. Do not expose the API, MQTT broker, or Zigbee2MQTT frontend to the public internet. Do not commit `.env`, Zigbee network keys, coordinator backups, or device identifiers.

## Project status and roadmap

1. Reproducible backend + MQTT integration
2. Hardware detection and setup/diagnostics CLI
3. Device discovery and control API
4. Room metadata persistence
5. iOS dashboard and controls
6. Cross-platform CI, recovery tests, release packaging, and security review

See [architecture](docs/architecture.md), [supported hardware](docs/supported-hardware.md), and [contributing](CONTRIBUTING.md).

## License

Apache-2.0. See [LICENSE](LICENSE).

## Name and affiliation

“OpenHome” is a temporary working name and has not been cleared for trademark or repository-name availability. This is an independent community project and is not affiliated with or endorsed by IKEA, SONOFF, Zigbee Alliance/Connectivity Standards Alliance, or the maintainers of Zigbee2MQTT/Mosquitto.
