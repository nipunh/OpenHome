# Installation guide (scaffold)

## Before you begin

- Use a supported Zigbee coordinator with coordinator firmware.
- Stop any other service using the coordinator's serial port (for example, another Zigbee stack).
- Keep the coordinator plugged into the machine that runs Zigbee2MQTT, or use a supported network coordinator connection.
- Back up existing Zigbee2MQTT data before migrating an existing network. Do not point this project at an existing Zigbee network without understanding the implications.

## Linux with Docker Compose

1. Install Docker Engine and the Compose plugin using Docker's official instructions.
2. Clone this repository and review `.env.example`.
3. Edit `deploy/zigbee2mqtt/configuration.yaml`; set `serial.port` to a stable path such as `/dev/serial/by-id/...` and choose the correct adapter for your coordinator.
4. Run from the repository root:

   ```sh
   docker compose -f deploy/compose.yaml up -d --build
   ```

5. Check `http://127.0.0.1:3000/health` and `http://127.0.0.1:8080`.

The Compose scaffold does not yet automatically detect USB devices or rewrite the Zigbee2MQTT config. Those are planned installer tasks. Validate serial device permissions and Docker device access before relying on it.

## macOS and Windows

Docker Desktop runs Linux containers in a VM, and directly attached USB serial hardware may not be passed through to the container. For those hosts, the initial reliable route may be to run Mosquitto and Zigbee2MQTT natively and point the OpenHome API at the broker. Native instructions and automated detection are still being developed; consult the official upstream installation documentation for each component.

## Native API development

```sh
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm install
pnpm dev:api
```

The API defaults to loopback (`127.0.0.1`) for safety. Set `MQTT_URL` only to a broker you control.

## Troubleshooting checklist

- Is the coordinator detected by the operating system?
- Is the adapter using coordinator firmware supported by Zigbee2MQTT?
- Is the serial port free, and does the service have permission to open it?
- Is the adapter type correct (`ember` for the reference ZBDongle-E; other models may require a different adapter)?
- Can the API reach MQTT?
- Does Zigbee2MQTT show `bridge/state` as online?
- Are you using a persistent data directory?
