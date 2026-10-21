import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import mqtt from 'mqtt';

const brokerPort = 31883;
const apiPort = 3102;
const baseUrl = `http://127.0.0.1:${apiPort}`;
const brokerUrl = `mqtt://127.0.0.1:${brokerPort}`;
const apiCwd = new URL('..', import.meta.url).pathname;

const hasMosquitto =
  spawnSync('mosquitto', ['-h'], { stdio: 'ignore' }).status === 0;

test(
  'API discovers a test device and publishes validated commands',
  { skip: !hasMosquitto && 'Mosquitto is not installed; skipping MQTT integration test' },
  async (t) => {
    const broker = spawn(
      'mosquitto',
      ['-p', String(brokerPort), '-v'],
      { stdio: 'ignore' },
    );

    let api;
    let client;

    try {
      client = mqtt.connect(brokerUrl, {
        reconnectPeriod: 0,
        connectTimeout: 3_000,
      });

      await new Promise((resolve, reject) => {
        client.once('connect', resolve);
        client.once('error', reject);
      });

      const env = {
        ...process.env,
        OPENHOME_HOST: '127.0.0.1',
        OPENHOME_PORT: String(apiPort),
        MQTT_URL: brokerUrl,
      };

      api = spawn(
        process.execPath,
        ['--import', 'tsx', 'src/index.ts'],
        { cwd: apiCwd, env, stdio: 'ignore' },
      );

      let ready = false;

      for (let i = 0; i < 50; i++) {
        if (api.exitCode !== null) {
          assert.fail(`API exited unexpectedly: ${api.exitCode}`);
        }

        try {
          const response = await fetch(`${baseUrl}/health`);
          const body = await response.json();

          if (body.mqttConnected) {
            ready = true;
            break;
          }
        } catch {
          // API may still be starting.
        }

        await delay(100);
      }

      assert.ok(ready, 'API did not connect to the test broker');

      await new Promise((resolve, reject) => {
        client.subscribe('zigbee2mqtt/Test Lamp/set', (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      client.publish(
  'zigbee2mqtt/bridge/devices',
  JSON.stringify([
    {
      friendly_name: 'Test Lamp',
      ieee_address: '0x00124b0000000001',
      type: 'Router',
      definition: {
        model: 'TEST-BULB',
        description: 'Test bulb',
        vendor: 'OpenHome tests',
        exposes: [
          {
            type: 'light',
            features: [
              {
                type: 'numeric',
                name: 'brightness',
                property: 'brightness',
                value_min: 10,
                value_max: 200,
              },
              {
                type: 'numeric',
                name: 'color_temp',
                property: 'color_temp',
                value_min: 200,
                value_max: 400,
              },
            ],
          },
        ],
      },
    },
  ]),
);

      let devicesResponse;
      let devicesBody;

      for (let i = 0; i < 30; i++) {
        devicesResponse = await fetch(`${baseUrl}/devices`);
        devicesBody = await devicesResponse.json();

        if (devicesBody.count === 1) break;
        await delay(100);
      }

      assert.equal(devicesResponse.status, 200);
assert.equal(devicesBody.count, 1);
assert.equal(devicesBody.devices[0].name, 'Test Lamp');

assert.deepEqual(devicesBody.devices[0].brightnessRange, {
  min: 10,
  max: 200,
});

assert.deepEqual(devicesBody.devices[0].colorTemperatureRange, {
  min: 200,
  max: 400,
});

      const receivedCommand = new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Timed out waiting for MQTT command')),
          3_000,
        );

        client.once('message', (topic, payload) => {
          clearTimeout(timeout);
          resolve({ topic, body: JSON.parse(payload.toString()) });
        });

        // Subscribe again to ensure the command listener is active.
        client.subscribe('zigbee2mqtt/Test Lamp/set');
      });

      const commandResponse = await fetch(
        `${baseUrl}/devices/${encodeURIComponent('Test Lamp')}/set`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ state: 'OFF' }),
        },
      );

      assert.equal(commandResponse.status, 202);
      assert.equal((await commandResponse.json()).accepted, true);

      const received = await receivedCommand;
      assert.equal(received.topic, 'zigbee2mqtt/Test Lamp/set');
      assert.deepEqual(received.body, { state: 'OFF' });

      const invalidResponse = await fetch(
        `${baseUrl}/devices/${encodeURIComponent('Test Lamp')}/set`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ brightness: 999 }),
        },
      );

      assert.equal(invalidResponse.status, 400);
      assert.equal(
        (await invalidResponse.json()).error,
        'invalid_brightness',
      );

      const unknownResponse = await fetch(
        `${baseUrl}/devices/Unknown%20Device/set`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ state: 'OFF' }),
        },
      );

      assert.equal(unknownResponse.status, 404);
      assert.equal(
        (await unknownResponse.json()).error,
        'device_not_found',
      );
    } finally {
      if (api && api.exitCode === null) api.kill('SIGTERM');

      if (client) {
        await new Promise((resolve) => client.end(true, resolve));
      }

      if (broker.exitCode === null) broker.kill('SIGTERM');
    }
  },
);
