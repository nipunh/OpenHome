
## iOS App

The iOS client is being developed with **React Native and Expo**. It communicates with the OpenHome API over the local network rather than connecting directly to the MQTT broker.

Current development focuses on a modern home dashboard and device controls.

### Features

- Home overview and room cards
- Room-based device lists
- Light controls, including on/off and brightness where supported
- Device state and connectivity feedback
- Backend connection and setup status

Feature availability depends on the current implementation and the capabilities exposed by each device.

### Networking and Security

- The app communicates with the OpenHome backend over the local network.
- MQTT broker credentials must never be stored in the mobile app.
- The app must not connect directly to the MQTT broker.
- Configure the API base URL to point to a backend reachable from the iOS device.
- When iOS requests Local Network permission, explain why access is needed to discover or communicate with services on the home network.

### Development Status

The mobile interface is under active development. Screens and device controls may evolve as the API contracts and application architecture mature.
