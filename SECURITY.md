# Security policy

This project is an early scaffold and is not yet recommended for security-critical deployments.

## Reporting a vulnerability

Please do not report exploitable vulnerabilities in public issues. Until a private security contact is configured, do not include secrets or personal data in reports; open a minimal issue asking maintainers for a private reporting channel.

## Deployment guidance

- Do not expose MQTT, Zigbee2MQTT frontend, or the API directly to the public internet.
- Do not commit `.env`, Zigbee network keys, coordinator backups, or sensitive logs.
- The current Compose Mosquitto configuration is intended only for local development and uses anonymous access. Do not expose it beyond loopback; production LAN authentication is a release blocker.
- Use supported firmware and keep upstream components updated through tested releases.
- Review and back up persistent data before upgrading.
