export type Device = {
  id: string;
  name: string;
  model?: string;
  vendor?: string;
  roomId: string | null;
  availability: 'online' | 'offline' | 'unknown';
  supportsOnOff: boolean;
  supportsBrightness: boolean;
  supportsColorTemperature: boolean;
  brightnessRange?: {
    min: number;
    max: number;
  };
  colorTemperatureRange?: {
    min: number;
    max: number;
  };
  state: {
    on?: boolean;
    brightness?: number;
    color_temp?: number;
  };
};

export type Room = {
  id: string;
  name: string;
  deviceCount: number;
};

export type DeviceResponse = {
  devices: Device[];
  count: number;
  mqttConnected: boolean;
};

export type RoomResponse = {
  rooms: Room[];
};

export type DeviceCommand = {
  state?: 'ON' | 'OFF';
  brightness?: number;
  color_temp?: number;
};

type ApiErrorResponse = {
  error?: string;
};

const REQUEST_TIMEOUT_MS = 10_000;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

async function request<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = normalizeBaseUrl(baseUrl);

  if (!base) {
    throw new Error('Enter the address of your OpenHome API.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
    });

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    if (!response.ok) {
      const apiError =
        body && typeof body === 'object' && 'error' in body
          ? (body as ApiErrorResponse).error
          : undefined;

      throw new Error(apiError || `API returned HTTP ${response.status}`);
    }

    if (body === undefined) {
      throw new Error('The API returned an invalid response.');
    }

    return body as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The API request timed out. Check the connection.');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getDevices(baseUrl: string): Promise<DeviceResponse> {
  return request<DeviceResponse>(baseUrl, '/devices');
}

export function getRooms(baseUrl: string): Promise<RoomResponse> {
  return request<RoomResponse>(baseUrl, '/rooms');
}

export function createRoom(baseUrl: string, name: string): Promise<unknown> {
  return request(baseUrl, '/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function assignDeviceToRoom(
  baseUrl: string,
  deviceId: string,
  roomId: string | null,
): Promise<unknown> {
  return request(baseUrl, `/devices/${encodeURIComponent(deviceId)}/room`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId }),
  });
}

export function sendDeviceCommand(
  baseUrl: string,
  deviceId: string,
  command: DeviceCommand,
): Promise<unknown> {
  return request(baseUrl, `/devices/${encodeURIComponent(deviceId)}/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
}

export type PairingResponse = {
  pairing: boolean;
  expiresAt: number | null;
};

export function startPairing(
  baseUrl: string,
  duration = 120,
): Promise<PairingResponse> {
  return request<PairingResponse>(baseUrl, '/pairing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration }),
  });
}

export function stopPairing(
  baseUrl: string,
): Promise<PairingResponse> {
  return request<PairingResponse>(baseUrl, '/pairing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'stop' }),
  });
}

export function getPairingStatus(
  baseUrl: string,
): Promise<PairingResponse> {
  return request<PairingResponse>(baseUrl, '/pairing');
}
