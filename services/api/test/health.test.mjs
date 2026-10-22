import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';

const port = 3101;
const baseUrl = `http://127.0.0.1:${port}`;

const env = {
  ...process.env,
  OPENHOME_HOST: '127.0.0.1',
  OPENHOME_PORT: String(port),
};
delete env.MQTT_URL;

const server = spawn(
  process.execPath,
  ['--import', 'tsx', 'src/index.ts'],
  {
    cwd: new URL('..', import.meta.url).pathname,
    env,
    stdio: 'ignore',
  },
);

after(() => {
  server.kill('SIGTERM');
});

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) {
      assert.fail(`API exited unexpectedly with code ${server.exitCode}`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return response;
    } catch {
      // The server may still be starting.
    }

    await delay(100);
  }

  assert.fail('API did not start within 4 seconds');
}

test('health endpoint reports API ready without MQTT', async () => {
  const response = await waitForServer();

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'openhome-api');
  assert.equal(body.mqttConfigured, false);
  assert.equal(body.mqttConnected, false);
  assert.equal(body.knownDeviceStates, 0);
});

test('device discovery returns an empty list without MQTT', async () => {
  await waitForServer();

  const response = await fetch(`${baseUrl}/devices`);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.deepEqual(body.devices, []);
  assert.equal(body.count, 0);
  assert.equal(body.mqttConnected, false);
});

test('unknown routes return 404 JSON', async () => {
  await waitForServer();

  const response = await fetch(`${baseUrl}/does-not-exist`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'not_found' });
});

test('device commands fail safely when MQTT is unavailable', async () => {
  await waitForServer();

  const response = await fetch(
    `${baseUrl}/devices/Round%20Lamp/set`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: 'OFF' }),
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'mqtt_unavailable' });
});
