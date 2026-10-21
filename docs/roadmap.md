# Roadmap

## Phase 0 — Repository foundation
- [x] Apache-2.0 license and community files
- [x] Initial monorepo layout
- [x] Backend health endpoint and MQTT connection skeleton
- [x] Initial Compose and documentation scaffold
- [ ] Verify clean clone on Linux, macOS, Windows

## Phase 1 — Reproducible setup
- [ ] Cross-platform CLI (`setup`, `doctor`, `start`, `stop`, `backup`, `restore`)
- [ ] Safe adapter detection and explicit unsupported-hardware messages
- [ ] Generated secrets and persistent configuration
- [ ] Authenticated broker profile for LAN deployment
- [ ] Automated install and uninstall tests

## Phase 2 — Core smart-home functionality
- [ ] Device discovery from Zigbee2MQTT bridge topics
- [ ] Capability-aware on/off and brightness commands
- [ ] SQLite migrations for rooms and device metadata
- [ ] WebSocket live state stream
- [ ] API contract and integration tests

## Phase 3 — User interfaces
- [ ] Home dashboard
- [ ] Room list and room management
- [ ] Device control screens
- [ ] iOS local-network permission and connection onboarding

## Phase 4 — Stable release readiness
- [ ] Platform/hardware test matrix
- [ ] Backup/restore and upgrade/rollback tests
- [ ] Dependency and container image update policy
- [ ] Threat model and security review
- [ ] Versioned releases and migration policy
