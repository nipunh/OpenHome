
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import mqtt, { type MqttClient } from 'mqtt';

const host = process.env.OPENHOME_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.OPENHOME_PORT ?? '3000', 10);
const mqttUrl = process.env.MQTT_URL;
const baseTopic = process.env.ZIGBEE2MQTT_BASE_TOPIC ?? 'zigbee2mqtt';

type ZigbeeDevice = {
  friendly_name?: string;
  ieee_address?: string;
  type?: string;
  definition?: {
    model?: string;
    description?: string;
    vendor?: string;
    exposes?: unknown[];
  };
};

type DeviceCommand = {
  state?: 'ON' | 'OFF';
  brightness?: number;
  color_temp?: number;
};

let mqttClient: MqttClient | undefined;
let mqttConnected = false;
let deviceInventory: ZigbeeDevice[] = [];

const latestDeviceState = new Map<string, unknown>();

function hasExpose(value: unknown, names: string[]): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasExpose(item, names));
  }

  if (typeof value !== 'object' || value === null) return false;

  const item = value as Record<string, unknown>;

  if (
    (typeof item.property === 'string' && names.includes(item.property)) ||
    (typeof item.name === 'string' && names.includes(item.name))
  ) {
    return true;
  }

  return Object.values(item).some((child) => hasExpose(child, names));
}

type NumericRange = {
  min: number;
  max: number;
};

function getNumericExposeRange(
  value: unknown,
  propertyName: string,
): NumericRange | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const range = getNumericExposeRange(item, propertyName);
      if (range) return range;
    }
    return undefined;
  }

  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const item = value as Record<string, unknown>;

  if (
    (item.property === propertyName || item.name === propertyName) &&
    typeof item.value_min === 'number' &&
    Number.isFinite(item.value_min) &&
    typeof item.value_max === 'number' &&
    Number.isFinite(item.value_max) &&
    item.value_min <= item.value_max
  ) {
    return {
      min: item.value_min,
      max: item.value_max,
    };
  }

  for (const child of Object.values(item)) {
    const range = getNumericExposeRange(child, propertyName);
    if (range) return range;
  }

  return undefined;
}

function sendJson(
  response: ServerResponse,
  status: number,
  data: unknown,
): void {
  response.writeHead(status).end(JSON.stringify(data));
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;

    request.on('data', (chunk: Buffer) => {
      if (tooLarge) return;

      body += chunk.toString();

      if (Buffer.byteLength(body) > 16_384) {
        tooLarge = true;
        body = '';
      }
    });

    request.on('end', () => {
      if (tooLarge) {
        reject(new Error('body_too_large'));
      } else {
        resolve(body);
      }
    });

    request.on('error', reject);
  });
}

if (mqttUrl) {
  mqttClient = mqtt.connect(mqttUrl, {
    ...(process.env.MQTT_USERNAME
      ? { username: process.env.MQTT_USERNAME }
      : {}),
    ...(process.env.MQTT_PASSWORD
      ? { password: process.env.MQTT_PASSWORD }
      : {}),
    reconnectPeriod: 3_000,
    connectTimeout: 10_000,
  });

  mqttClient.on('connect', () => {
    mqttConnected = true;

    mqttClient?.subscribe(
      [`${baseTopic}/+`, `${baseTopic}/bridge/devices`],
      (error) => {
        if (error) {
          console.error('MQTT subscribe failed:', error.message);
        }
      },
    );
  });

  mqttClient.on('reconnect', () => {
    mqttConnected = false;
  });

  mqttClient.on('close', () => {
    mqttConnected = false;
  });

  mqttClient.on('error', (error) => {
    console.error('MQTT error:', error.message);
  });

  mqttClient.on('message', (topic, payload) => {
    const message = payload.toString();

    if (topic === `${baseTopic}/bridge/devices`) {
      try {
        const parsed: unknown = JSON.parse(message);

        if (Array.isArray(parsed)) {
          deviceInventory = parsed as ZigbeeDevice[];

          // Populate the live-state cache after receiving the inventory.
          for (const device of deviceInventory) {
            const name = device.friendly_name;

            if (
              !name ||
              name === 'Coordinator' ||
              device.type === 'Coordinator'
            ) {
              continue;
            }

            mqttClient?.publish(
              `${baseTopic}/${name}/get`,
              JSON.stringify({ state: '' }),
              (error) => {
                if (error) {
                  console.error(
                    `Unable to request state for ${name}:`,
                    error.message,
                  );
                }
              },
            );
          }
        }
      } catch {
        console.error('Unable to parse Zigbee2MQTT device inventory');
      }

      return;
    }

    const prefix = `${baseTopic}/`;

    if (!topic.startsWith(prefix)) return;

    const deviceId = topic.slice(prefix.length);

    if (!deviceId || deviceId === 'bridge' || deviceId.includes('/')) {
      return;
    }

    try {
      latestDeviceState.set(deviceId, JSON.parse(message));
    } catch {
      // Ignore messages that aren't JSON device state.
    }
  });
}

async function handleDeviceCommand(
  request: IncomingMessage,
  response: ServerResponse,
  deviceName: string,
): Promise<void> {
  if (!mqttUrl || !mqttClient || !mqttConnected) {
    sendJson(response, 503, { error: 'mqtt_unavailable' });
    return;
  }

  const device = deviceInventory.find(
    (item) =>
      item.friendly_name === deviceName &&
      item.type !== 'Coordinator' &&
      item.friendly_name !== 'Coordinator',
  );

  if (!device) {
    sendJson(response, 404, { error: 'device_not_found' });
    return;
  }

  let body: string;

  try {
    body = await readRequestBody(request);
  } catch (error) {
    sendJson(
      response,
      error instanceof Error && error.message === 'body_too_large'
        ? 413
        : 400,
      { error: 'invalid_request_body' },
    );
    return;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    sendJson(response, 400, { error: 'invalid_json' });
    return;
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    sendJson(response, 400, { error: 'command_must_be_object' });
    return;
  }

  const input = parsed as Record<string, unknown>;
  const keys = Object.keys(input);

  if (
    keys.length === 0 ||
    keys.some((key) => !['state', 'brightness', 'color_temp'].includes(key))
  ) {
    sendJson(response, 400, { error: 'unsupported_command_field' });
    return;
  }

  const command: DeviceCommand = {};

  if ('state' in input) {
    if (input.state !== 'ON' && input.state !== 'OFF') {
      sendJson(response, 400, {
        error: 'invalid_state',
        allowed: ['ON', 'OFF'],
      });
      return;
    }

    command.state = input.state;
  }

  if ('brightness' in input) {
    if (
      typeof input.brightness !== 'number' ||
      !Number.isInteger(input.brightness) ||
      input.brightness < 0 ||
      input.brightness > 254
    ) {
      sendJson(response, 400, {
        error: 'invalid_brightness',
        minimum: 0,
        maximum: 254,
      });
      return;
    }

    command.brightness = input.brightness;
  }

  if ('color_temp' in input) {
    if (
      typeof input.color_temp !== 'number' ||
      !Number.isInteger(input.color_temp) ||
      input.color_temp < 153 ||
      input.color_temp > 454
    ) {
      sendJson(response, 400, {
        error: 'invalid_color_temp',
        minimum: 153,
        maximum: 454,
        unit: 'mired',
      });
      return;
    }

    command.color_temp = input.color_temp;
  }

  mqttClient.publish(
    `${baseTopic}/${deviceName}/set`,
    JSON.stringify(command),
    { qos: 1 },
    (error) => {
      if (error) {
        sendJson(response, 502, { error: 'mqtt_publish_failed' });
        return;
      }

      sendJson(response, 202, {
        accepted: true,
        device: deviceName,
        command,
        message: 'Command published; device response not yet confirmed.',
      });
    },
  );
}


// ROOM_STORAGE_V1
type StoredRoom = { id: string; name: string; icon?: string; color?: string };
type RoomStore = { rooms: StoredRoom[]; assignments: Record<string, string> };

const roomDataDirectory = join(process.cwd(), 'data');
const roomDataFile = join(roomDataDirectory, 'rooms.json');

function loadRoomStore(): RoomStore {
  try {
    const value = JSON.parse(readFileSync(roomDataFile, 'utf8')) as RoomStore;
    if (Array.isArray(value.rooms) && value.assignments &&
        typeof value.assignments === 'object') return value;
  } catch {
    // Missing file means a new, empty room store.
  }
  return { rooms: [], assignments: {} };
}

let roomStore = loadRoomStore();

function saveRoomStore(): void {
  mkdirSync(roomDataDirectory, { recursive: true });
  const temporaryFile = roomDataFile + '.tmp';
  writeFileSync(temporaryFile, JSON.stringify(roomStore, null, 2) + '\n');
  renameSync(temporaryFile, roomDataFile);
}

function roomSummaries() {
  return roomStore.rooms.map((room) => ({
    ...room,
    deviceCount: Object.values(roomStore.assignments)
      .filter((roomId) => roomId === room.id).length,
  }));
}

const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('cache-control', 'no-store');
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'openhome-api',
      mqttConfigured: Boolean(mqttUrl),
      mqttConnected,
      knownDeviceStates: latestDeviceState.size,
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/devices') {
    const devices = deviceInventory
      .filter(
        (device) =>
          device.friendly_name &&
          device.friendly_name !== 'Coordinator' &&
          device.type !== 'Coordinator',
      )
      .map((device) => ({
        id: device.friendly_name,
        name: device.friendly_name,
        ieeeAddress: device.ieee_address,
        type: device.type,
        model: device.definition?.model,
        description: device.definition?.description,
        vendor: device.definition?.vendor,
        roomId: device.ieee_address
          ? (roomStore.assignments[device.ieee_address] ?? null)
          : null,
        availability: latestDeviceState.has(device.friendly_name!)
          ? 'online'
          : 'unknown',
        supportsOnOff: hasExpose(device.definition?.exposes, [
          'state',
          'light',
          'switch',
        ]),
        supportsBrightness: hasExpose(device.definition?.exposes, [
  'brightness',
]),
supportsColorTemperature: hasExpose(device.definition?.exposes, [
  'color_temp',
]),
brightnessRange: getNumericExposeRange(
  device.definition?.exposes,
  'brightness',
),
colorTemperatureRange: getNumericExposeRange(
  device.definition?.exposes,
  'color_temp',
),
        rawState: latestDeviceState.get(device.friendly_name!) ?? null,
        state: (() => {
          const raw = latestDeviceState.get(device.friendly_name!);
          if (typeof raw !== 'object' || raw === null) return {};

          const current = raw as Record<string, unknown>;
          return {
            ...(current.state === 'ON' ? { on: true } : {}),
            ...(current.state === 'OFF' ? { on: false } : {}),
            ...(typeof current.brightness === 'number'
              ? { brightness: current.brightness }
              : {}),
            ...(typeof current.color_temp === 'number'
              ? { color_temp: current.color_temp }
              : {}),
          };
        })(),
      }));

    sendJson(response, 200, {
      devices,
      count: devices.length,
      mqttConnected,
    });
    return;
  }


  if (request.method === 'GET' && url.pathname === '/rooms') {
    sendJson(response, 200, { rooms: roomSummaries() });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/rooms') {
    void (async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await readRequestBody(request));
      } catch {
        sendJson(response, 400, { error: 'invalid_json' });
        return;
      }

      if (typeof parsed !== 'object' || parsed === null ||
          Array.isArray(parsed) ||
          typeof (parsed as Record<string, unknown>).name !== 'string') {
        sendJson(response, 400, { error: 'room_name_required' });
        return;
      }

      const input = parsed as Record<string, unknown>;
      const name = (input.name as string).trim();
      if (!name || name.length > 60) {
        sendJson(response, 400, { error: 'invalid_room_name' });
        return;
      }

      if (roomStore.rooms.some((room) =>
          room.name.toLowerCase() === name.toLowerCase())) {
        sendJson(response, 409, { error: 'room_name_exists' });
        return;
      }

      const room: StoredRoom = { id: randomUUID(), name };
      if (typeof input.icon === 'string') room.icon = input.icon;
      if (typeof input.color === 'string') room.color = input.color;

      roomStore.rooms.push(room);
      try {
        saveRoomStore();
      } catch {
        roomStore.rooms = roomStore.rooms.filter((item) => item.id !== room.id);
        sendJson(response, 500, { error: 'room_save_failed' });
        return;
      }

      sendJson(response, 201, { room: { ...room, deviceCount: 0 } });
    })();
    return;
  }

  const roomAssignmentMatch = url.pathname.match(/^\/devices\/([^/]+)\/room$/);
  if (request.method === 'PATCH' && roomAssignmentMatch) {
    void (async () => {
      let deviceName: string;
      try {
        deviceName = decodeURIComponent(roomAssignmentMatch[1]!);
      } catch {
        sendJson(response, 400, { error: 'invalid_device_name' });
        return;
      }

      const device = deviceInventory.find((item) =>
        item.friendly_name === deviceName &&
        item.type !== 'Coordinator' &&
        item.friendly_name !== 'Coordinator' &&
        item.ieee_address);

      if (!device?.ieee_address) {
        sendJson(response, 404, { error: 'device_not_found' });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(await readRequestBody(request));
      } catch {
        sendJson(response, 400, { error: 'invalid_json' });
        return;
      }

      if (typeof parsed !== 'object' || parsed === null ||
          Array.isArray(parsed) ||
          !Object.prototype.hasOwnProperty.call(parsed, 'roomId')) {
        sendJson(response, 400, { error: 'room_id_required' });
        return;
      }

      const roomId = (parsed as Record<string, unknown>).roomId;
      if (roomId !== null &&
          (typeof roomId !== 'string' ||
           !roomStore.rooms.some((room) => room.id === roomId))) {
        sendJson(response, 400, { error: 'invalid_room_id' });
        return;
      }

      const address = device.ieee_address;
      const previous = roomStore.assignments[address];
      if (roomId === null) delete roomStore.assignments[address];
      else roomStore.assignments[address] = roomId;

      try {
        saveRoomStore();
      } catch {
        if (previous === undefined) delete roomStore.assignments[address];
        else roomStore.assignments[address] = previous;
        sendJson(response, 500, { error: 'room_save_failed' });
        return;
      }

      sendJson(response, 200, {
        device: device.friendly_name,
        ieeeAddress: address,
        roomId,
      });
    })();
    return;
  }

  const controlMatch = url.pathname.match(/^\/devices\/([^/]+)\/set$/);

  if (request.method === 'POST' && controlMatch) {
    let deviceName: string;

    try {
      deviceName = decodeURIComponent(controlMatch[1]!);
    } catch {
      sendJson(response, 400, { error: 'invalid_device_name' });
      return;
    }

    void handleDeviceCommand(request, response, deviceName);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/') {
    sendJson(response, 200, {
      name: 'OpenHome API',
      status: 'early-scaffold',
      endpoints: ['/health', '/devices', '/rooms', 'POST /rooms', 'PATCH /devices/:id/room', 'POST /devices/:id/set'],
      repository: 'https://github.com/nipunh/OpenHome',
    });
    return;
  }

  sendJson(response, 404, { error: 'not_found' });
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
