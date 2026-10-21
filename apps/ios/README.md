# iOS app (planned)

The native client will be built with React Native + Expo after the API contracts stabilise.

Initial screens:
- Home overview and room cards
- Room device list
- Light control (on/off and brightness when supported)
- Setup/connectivity status

Do not store MQTT credentials or connect the app directly to the MQTT broker. The app should communicate with the backend over the local network and explain the iOS Local Network permission when required.
