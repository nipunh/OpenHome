# Supported hardware

## Current status

| Hardware / environment | Status | Notes |
|---|---|---|
| SONOFF ZBDongle-E / V2 | Reference target; not yet CI-verified | Silicon Labs EmberZNet adapter; Zigbee2MQTT adapter setting is `ember`. Firmware must be compatible. |
| SONOFF ZBDongle-P | Planned | Uses a different chipset/adapter family; do not use the E configuration. |
| Other Zigbee2MQTT coordinators | Planned by compatibility testing | Use the official Zigbee2MQTT supported-adapter list. |
| Linux x86-64 / ARM64 | Target platform | Native USB serial access is generally the simplest container deployment path. |
| macOS | Development target | Docker Desktop USB serial passthrough can be a limitation. Native Zigbee2MQTT may be needed. |
| Windows 10/11 | Target platform | Native serial/COM support needs dedicated tests; Docker Desktop USB passthrough may be a limitation. |

Do not treat a device as officially supported until it has been tested and recorded here. Zigbee device compatibility is inherited from Zigbee2MQTT and each device's exposed capabilities.
