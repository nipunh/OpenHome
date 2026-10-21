/** Shared public API contracts. Keep these independent of platform APIs. */
export type DeviceAvailability = 'online' | 'offline' | 'unknown';

export interface DeviceSummary {
  id: string;
  name: string;
  roomId: string | null;
  availability: DeviceAvailability;
  supportsOnOff: boolean;
  supportsBrightness: boolean;
  state: {
    on?: boolean;
    brightness?: number;
  };
}

export interface RoomSummary {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  deviceCount: number;
}
