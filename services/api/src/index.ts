import { createServer } from 'node:http';
import mqtt, { type MqttClient } from 'mqtt';

const host = process.env.OPENHOME_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.OPENHOME_PORT ?? '3000', 10);
const mqttUrl = process.env.MQTT_URL;
const baseTopic = process.env.ZIGBEE2MQTT_BASE_TOPIC ?? 'zigbee2mqtt';

let mqttClient: MqttClient | undefined;
let mqttConnected = false;
const latestDeviceState = new Map<string, unknown>();

if (mqttUrl) {
  mqttClient = mqtt.connect(mqttUrl, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 3_000,
    connectTimeout: 10_000,
  });
  mqttClient.on('connect', () => {
    mqttConnected = true;
    mqttClient?.subscribe(`${baseTopic}/+`, (error) => {
      if (error) console.error('MQTT subscribe failed:', error.message);
    });
  });
  mqttClient.on('reconnect', () => { mqttConnected = false; });
  mqttClient.on('close', () => { mqttConnected = false; });
  mqttClient.on('error', (error) => console.error('MQTT error:', error.message));
  mqttClient.on('message', (topic, payload) => {
    const prefix = `${baseTopic}/`;
    if (!topic.startsWith(prefix)) return;
    const deviceId = topic.slice(prefix.length);
    if (!deviceId || deviceId === 'bridge' || deviceId.includes('/')) return;
    try {
      latestDeviceState.set(deviceId, JSON.parse(payload.toString()));
    } catch {
      // Ignore non-JSON topics; future routes will expose validated device state.
    }
  });
}

const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('cache-control', 'no-store');

  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200).end(JSON.stringify({
      status: 'ok',
      service: 'openhome-api',
      mqttConfigured: Boolean(mqttUrl),
      mqttConnected,
      knownDeviceStates: latestDeviceState.size,
    }));
    return;
  }

  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200).end(JSON.stringify({
      name: 'OpenHome API',
      status: 'early-scaffold',
      docs: 'https://github.com/REPLACE_WITH_ORG/openhome',
    }));
    return;
  }

  response.writeHead(404).end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, host, () => {
  console.log(`OpenHome API listening on http://${host}:${port}`);
});

function shutdown(): void {
  server.close(() => {
    mqttClient?.end(true, () => process.exit(0));
    if (!mqttClient) process.exit(0);
  });
  setTimeout(() => process.exit(1), 5_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
