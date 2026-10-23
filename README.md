
# OpenHome

**A local-first, self-hosted smart home for your Zigbee devices.**

OpenHome is an open-source smart-home platform that connects compatible Zigbee devices to a custom mobile application. It uses Zigbee2MQTT for device integration, MQTT for messaging, and a TypeScript backend to connect devices to the mobile interface.

The goal is to provide a modern home dashboard with device controls and room organisation without requiring an IKEA hub or a paid cloud service for basic local control.

> **Project status:** Active development. The API, MQTT integration, and mobile interface are evolving. Hardware compatibility and feature availability depend on the device models and local configuration.

## Features

- **Home dashboard:** A dedicated mobile interface for managing smart-home devices.
- **Device control:** Control supported devices, including on/off and brightness where available.
- **Zigbee integration:** Connect compatible devices through Zigbee2MQTT.
- **MQTT messaging:** Exchange device commands and state updates through a local broker.
- **Device discovery:** Integrate devices exposed by Zigbee2MQTT.
- **Room organisation:** Organise devices by room as supported by the implementation.
- **Local-first operation:** Keep core device communication on your local network.
- **Extensible architecture:** Separate mobile, backend, and Zigbee gateway components.

Device capabilities depend on the device model and the features exposed by Zigbee2MQTT. Features still under development should not be considered production-ready.

## Architecture

```text
┌───────────────────────────────────┐
│          Mobile Application       │
│       React Native / Expo         │
└─────────────────┬─────────────────┘
                  │ HTTP
                  ▼
┌───────────────────────────────────┐
│           OpenHome API            │
│         Node.js / TypeScript      │
│                                   │
│  Health checks                    │
│  Device state and commands        │
│  MQTT integration                 │
└─────────────────┬─────────────────┘
                  │ MQTT
                  ▼
┌───────────────────────────────────┐
│          Mosquitto Broker         │
└─────────────────┬─────────────────┘
                  │
                  ▼
┌───────────────────────────────────┐
│             Zigbee2MQTT           │
│                                   │
│  Device discovery                 │
│  Pairing and device communication │
└─────────────────┬─────────────────┘
                  │ Zigbee
                  ▼
┌───────────────────────────────────┐
│           Zigbee Devices          │
│       Lights, switches, etc.      │
└───────────────────────────────────┘
```

Mosquitto and Zigbee2MQTT are separate upstream services. OpenHome connects these services to the mobile application through its backend.

## Repository Structure

```text
OpenHome/
├── apps/
│   └── ios/                 # Mobile application
├── services/
│   └── api/                 # Backend API and MQTT integration
├── packages/
│   └── contracts/           # Shared types and API contracts
├── deploy/                  # Deployment configuration
├── scripts/                 # Development and diagnostic utilities
├── docs/                    # Technical documentation
├── .env.example             # Example environment configuration
├── docker-compose.yml       # Container orchestration, if present
├── package.json             # Root workspace scripts
├── pnpm-workspace.yaml      # pnpm workspace configuration
└── README.md
```

The repository layout may evolve as the application develops.

## Requirements

### Software

- Node.js version supported by the project
- pnpm, using the version specified by the repository
- Docker Engine and Docker Compose, if using container deployment
- Mosquitto MQTT broker
- Zigbee2MQTT

### Hardware

- A compatible Zigbee coordinator
- Compatible Zigbee devices, such as supported smart lights and switches
- A computer or server capable of running the backend and gateway services
- An iOS device or simulator for mobile application development

Coordinator firmware, serial-device configuration, and device compatibility must be verified for the actual hardware in use.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/nipunh/OpenHome.git
cd OpenHome
```

### 2. Install dependencies

Enable Corepack and activate the pnpm version specified by the project. For pnpm 10.8.1:

```bash
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm install
```

### 3. Configure environment variables

If the repository contains `.env.example`, create a local environment file:

```bash
cp .env.example .env
```

Review the available variables and configure the API, MQTT broker, and Zigbee2MQTT connection as required.

Do not commit `.env` files, passwords, Zigbee network keys, coordinator backups, or other secrets.

### 4. Configure Zigbee2MQTT

Follow the official installation documentation:

https://www.zigbee2mqtt.io/guide/installation/

Verify the following:

- The coordinator is detected by the host.
- The serial-device path is correct.
- The configured adapter matches the coordinator and firmware.
- Zigbee2MQTT can connect to the MQTT broker.
- The required Zigbee devices are paired and online.

For a SONOFF ZBDongle-E, verify the supported firmware and adapter configuration for your installed Zigbee2MQTT version rather than copying settings intended for another coordinator.

### 5. Start the backend API

From the repository root, use the API development command configured by the workspace:

```bash
pnpm --filter @openhome/api dev
```

Check the API health endpoint at the configured address and port. For example, if the API listens on port 3001:

```bash
curl http://127.0.0.1:3001/health
```

The port may differ depending on your environment. Confirm the actual API configuration before testing device commands.

Verify that the API starts successfully and that its MQTT connection is established.

### 6. Start the mobile application

Navigate to the mobile application directory:

```bash
cd apps/ios
```

Follow the scripts and dependencies defined in that directory's `package.json` to start the Expo or React Native development environment.

Configure the mobile app's API base URL to point to the running backend.

**Important:** On a physical phone, `localhost` refers to the phone itself, not your development computer. Use your computer's reachable local-network IP address when connecting from a physical device.

Ensure both devices are connected to a network that permits communication between the mobile client and the API.

## Container Deployment

Use Docker Compose only if the repository includes a suitable Compose configuration.

### 1. Configure environment variables

Create the environment file if an example is provided:

```bash
cp .env.example .env
```

Review every setting before starting services.

### 2. Configure the Zigbee coordinator

Set the serial-device path to the device visible to the container runtime. Verify the Zigbee2MQTT adapter configuration for your coordinator.

### 3. Start the services

If a Docker Compose configuration is present:

```bash
docker compose up -d --build
```

Inspect running containers:

```bash
docker compose ps
```

Inspect service logs:

```bash
docker compose logs -f
```

Stop the services when needed:

```bash
docker compose down
```

**Platform limitation:** USB serial passthrough differs between Linux, macOS, and Windows. Docker Desktop may not expose a directly attached USB serial coordinator to Linux containers. For unsupported combinations, run Zigbee2MQTT natively on the host and configure the MQTT connection accordingly.

## Configuration and Networking

OpenHome consists of several independently configured components:

| Component | Responsibility |
|---|---|
| Mobile app | Displays the dashboard and sends user actions |
| OpenHome API | Exposes the backend interface and integrates with MQTT |
| Mosquitto | Routes MQTT messages between services |
| Zigbee2MQTT | Manages Zigbee devices and supported commands |
| Zigbee coordinator | Provides the radio connection to the Zigbee network |

Keep these services on a trusted local network. Do not expose the API, MQTT broker, or Zigbee2MQTT management interface directly to the public internet.

For remote access, implement appropriate authentication, authorisation, transport security, and network controls before exposing any service outside your local network.

## Troubleshooting

### The API does not start

1. Check that dependencies are installed.
2. Verify the Node.js and pnpm versions.
3. Check the API logs for configuration or port errors.
4. Confirm that the configured port is not already in use.
5. Check that required environment variables are present.

### The health endpoint does not respond

1. Confirm that the backend process is running.
2. Verify the hostname, port, and route.
3. Test the endpoint locally using `curl`.
4. Check whether the mobile app and API use the correct addresses.

### MQTT is disconnected

1. Confirm that Mosquitto is running.
2. Verify the broker hostname, port, credentials, and connection settings.
3. Check the broker and API logs.
4. Confirm that Zigbee2MQTT is connected to the intended broker.

### Devices are missing or their state is stale

1. Confirm that Zigbee2MQTT is running.
2. Check that the Zigbee device is paired and online.
3. Verify the Zigbee2MQTT bridge state.
4. Inspect the device's MQTT topic and reported state.
5. Confirm that the API receives state updates.
6. Check that the mobile app can reach the API and refresh its device state.

### Commands do not affect a device

1. Confirm that the device supports the requested capability.
2. Verify that the device is online.
3. Check that the API publishes the expected command.
4. Inspect Zigbee2MQTT logs for command errors.
5. Verify the reported device state after sending the command.

### The mobile app cannot connect to the API

1. Confirm that the API is running.
2. Check the API base URL in the mobile configuration.
3. Do not use the phone's `localhost` address to reach a backend running on your computer.
4. Verify that the phone and computer can communicate over the local network.
5. Check local firewall rules and network isolation settings.

## Development

Run commands from the repository root unless otherwise indicated.

### Start the API

```bash
pnpm --filter @openhome/api dev
```

### Build the workspace

```bash
pnpm build
```

### Type-check the code

```bash
pnpm typecheck
```

### Run tests

```bash
pnpm test
```

### Run linting

```bash
pnpm lint
```

These commands depend on the scripts defined in the root `package.json` and individual workspace packages. Check the actual scripts before running them if a command is unavailable.

Before submitting changes:

- Run the relevant type checks and tests.
- Confirm that the API starts successfully.
- Verify MQTT connectivity.
- Test device commands against supported hardware where available.
- Distinguish simulated or mocked tests from tests performed against real Zigbee devices.

## Project Status and Roadmap

OpenHome is under active development. Potential areas for further work include:

1. Improving backend reliability and MQTT recovery.
2. Strengthening device discovery and diagnostics.
3. Expanding device-control capabilities.
4. Improving room and device configuration persistence.
5. Refining the mobile dashboard and user experience.
6. Expanding automated tests and cross-platform support.
7. Improving security, deployment, and recovery workflows.
8. Adding scenes, schedules, and automations where not yet implemented.

Items on this roadmap are not guarantees of current functionality.

## Contributing

Contributions, bug reports, and suggestions are welcome.

Before contributing:

1. Review the existing architecture and documentation.
2. Keep changes focused and compatible with the existing workspace.
3. Add or update tests where appropriate.
4. Avoid committing credentials, private configuration, or device secrets.
5. Document any new configuration requirements.

See `CONTRIBUTING.md` if available.

## License

OpenHome is licensed under the Apache License 2.0 if the repository's `LICENSE` file confirms that license. See `LICENSE` for the full license text.

## Name and Affiliation

OpenHome is an independent community project. It is not affiliated with or endorsed by IKEA, SONOFF, Zigbee2MQTT, Mosquitto, or the Connectivity Standards Alliance.
