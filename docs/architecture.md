# Architecture

## Principles

1. Local-first: normal device control should not require a cloud account or internet connection.
2. Keep Zigbee radio communication in Zigbee2MQTT; OpenHome consumes its documented MQTT interface.
3. Keep API and domain logic cross-platform. OS-specific code belongs in installer and hardware-detection modules.
4. Do not let the mobile app connect directly to MQTT or store broker credentials.
5. Preserve Zigbee2MQTT data and OpenHome metadata in persistent storage.

## Components

- Zigbee coordinator: SONOFF ZBDongle-E is the initial reference device.
- Zigbee2MQTT: coordinator and device protocol integration.
- Mosquitto: local MQTT broker.
- API: HTTP endpoints for commands/configuration and WebSocket updates for live state.
- SQLite: rooms, display names, favourites, and app settings (planned).
- iOS client: React Native + Expo (planned).

## MQTT boundaries

Use the configured Zigbee2MQTT base topic. Discover devices through `bridge/devices`, observe `bridge/state`, and consume per-device state topics. Commands must be validated against device capabilities before publishing. Avoid blindly publishing arbitrary topics supplied by clients.

## Network exposure

Bind local-only services to loopback by default. A future LAN-access setup must provide authentication, explicit user consent, and documented firewall guidance. Never expose MQTT or the Zigbee2MQTT frontend directly to the public internet.
