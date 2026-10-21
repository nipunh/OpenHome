import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  type Device,
  type Room,
  getDevices,
  getRooms,
  createRoom as apiCreateRoom,
  assignDeviceToRoom as apiAssignDeviceToRoom,
  sendDeviceCommand as apiSendDeviceCommand,
} from './src/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Pressable,
  View,
} from 'react-native';

const DEFAULT_API_URL = "http://127.0.0.1:3000/";

export default function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [roomBusy, setRoomBusy] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyDevices, setBusyDevices] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const baseUrl = apiUrl.trim().replace(/\/+$/, '');

  const refresh = useCallback(async () => {
    if (!baseUrl) {
      setError('Enter the address of your OpenHome API.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await getDevices(baseUrl);
      const roomResult = await getRooms(baseUrl);

      setRooms(roomResult.rooms ?? []);
      setDevices(result.devices ?? []);
      setMqttConnected(Boolean(result.mqttConnected));
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {
      setError(
        'Could not reach OpenHome. Check the API address and make sure the API is running.',
      );
      setMqttConnected(false);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);


  const createRoom = async () => {
    const name = newRoomName.trim();
    if (!name || roomBusy) return;

    setRoomBusy(true);
    setError('');
    try {
      await apiCreateRoom(baseUrl, name);
      setNewRoomName('');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(
        message === 'room_name_exists'
          ? 'A room with that name already exists.'
          : message || 'Could not create the room.',
      );
    } finally {
      setRoomBusy(false);
    }
  };

  const assignRoom = async (device: Device, roomId: string | null) => {
    if (roomBusy || device.roomId === roomId) return;

    setRoomBusy(true);
    setError('');
    try {
      await apiAssignDeviceToRoom(baseUrl, device.id, roomId);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Could not move ${device.name}.`,
      );
    } finally {
      setRoomBusy(false);
    }
  };

  const sendCommand = async (
    device: Device,
    command: {
      state?: 'ON' | 'OFF';
      brightness?: number;
      color_temp?: number;
    },
  ) => {
    if (busyDevices.includes(device.id)) return;

    setBusyDevices((current) => [...current, device.id]);
    setError('');

    try {
      await apiSendDeviceCommand(baseUrl, device.id, command);

      // Reflect the accepted command immediately in the UI.
      setDevices((current) =>
        current.map((item) =>
          item.id === device.id
            ? {
                ...item,
                state: {
                  ...item.state,
                  ...(command.state
                    ? { on: command.state === 'ON' }
                    : {}),
                  ...(command.brightness !== undefined
                    ? { brightness: command.brightness }
                    : {}),
                  ...(command.color_temp !== undefined
                    ? { color_temp: command.color_temp }
                    : {}),
                },
              }
            : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not control ${device.name}: ${err.message}`
          : `Could not control ${device.name}.`,
      );
    } finally {
      setBusyDevices((current) =>
        current.filter((id) => id !== device.id),
      );
    }
  };

  const displayDevices = [...devices].sort((a, b) => {
    const roomA = rooms.find((room) => room.id === a.roomId)?.name ?? 'ZZZ';
    const roomB = rooms.find((room) => room.id === b.roomId)?.name ?? 'ZZZ';
    return roomA.localeCompare(roomB) || a.name.localeCompare(b.name);
  });

  const onlineCount = devices.filter(
    (device) => device.availability === 'online',
  ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR HOME</Text>
            <Text style={styles.title}>OpenHome</Text>
            <Text style={styles.subtitle}>
              Simple control. Local first.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refresh()}
            style={styles.refreshButton}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.refreshText}>↻</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusTop}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: mqttConnected ? '#38A878' : '#D99036' },
              ]}
            />
            <Text style={styles.statusTitle}>
              {mqttConnected ? 'System connected' : 'System disconnected'}
            </Text>
          </View>
          <Text style={styles.statusDescription}>
            {mqttConnected
              ? `${onlineCount} online · ${devices.length} ${
                  devices.length === 1 ? 'device' : 'devices'
                } discovered`
              : 'Check your API address and MQTT connection.'}
          </Text>
          {lastUpdated ? (
            <Text style={styles.updatedText}>Updated {lastUpdated}</Text>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Connection issue</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}


        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>Rooms</Text>
          <Text style={styles.settingsDescription}>
            Create rooms, then assign each device below.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <TextInput
                value={newRoomName}
                onChangeText={setNewRoomName}
                placeholder="New room name"
                placeholderTextColor="#8B928D"
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => void createRoom()}
                style={styles.urlInput}
                accessibilityLabel="New room name"
              />
            </View>
            <Pressable
              onPress={() => void createRoom()}
              disabled={roomBusy || !newRoomName.trim()}
              style={[
                styles.connectButton,
                { paddingHorizontal: 15, marginTop: 0, opacity: roomBusy || !newRoomName.trim() ? 0.55 : 1 },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.connectButtonText}>
                {roomBusy ? 'Saving…' : 'Add'}
              </Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {rooms.map((room) => (
              <View
                key={room.id}
                style={{
                  backgroundColor: '#E6F1E9',
                  borderRadius: 12,
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                }}
              >
                <Text style={{ color: '#26765A', fontSize: 12, fontWeight: '700' }}>
                  {room.name} · {room.deviceCount}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Your devices</Text>
          <Text style={styles.deviceCount}>{devices.length}</Text>
        </View>

        {loading && devices.length === 0 ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator size="large" color="#26765A" />
            <Text style={styles.emptyTitle}>Finding your devices…</Text>
          </View>
        ) : devices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⌂</Text>
            <Text style={styles.emptyTitle}>No devices yet</Text>
            <Text style={styles.emptyDescription}>
              Start Zigbee2MQTT and the OpenHome API, then refresh this page.
            </Text>
          </View>
        ) : (
          displayDevices.map((device) => {
            const isBusy = busyDevices.includes(device.id);
            const isOn = Boolean(device.state.on);
            const brightness = device.state.brightness ?? 254;
            const colorTemp = device.state.color_temp ?? 300;
            const kelvin = Math.round(1000000 / colorTemp / 100) * 100;

            return (
              <View key={device.id} style={styles.deviceCard}>
                <View style={styles.deviceHeader}>
                  <View
                    style={[
                      styles.bulbIcon,
                      isOn && styles.bulbIconOn,
                    ]}
                  >
                    <Text style={styles.bulbEmoji}>✳</Text>
                  </View>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceModel}>
                      {[device.vendor, device.model].filter(Boolean).join(' · ') ||
                        'Smart device'}
                    </Text>
                    <View style={styles.deviceStatusRow}>
                      <View
                        style={[
                          styles.miniDot,
                          {
                            backgroundColor:
                              device.availability === 'online'
                                ? '#38A878'
                                : '#B7B9B7',
                          },
                        ]}
                      />
                      <Text style={styles.deviceStatus}>
                        {device.availability === 'online'
                          ? isOn
                            ? 'On'
                            : 'Off'
                          : device.availability}
                      </Text>
                    </View>
                  </View>
                  {isBusy ? (
                    <ActivityIndicator color="#26765A" />
                  ) : device.supportsOnOff ? (
                    <Switch
                      value={isOn}
                      onValueChange={(value) =>
                        void sendCommand(device, {
                          state: value ? 'ON' : 'OFF',
                        })
                      }
                      trackColor={{ false: '#D8DCD8', true: '#8CC9AE' }}
                      thumbColor={isOn ? '#26765A' : '#FFFFFF'}
                      accessibilityLabel={`Turn ${device.name} ${
                        isOn ? 'off' : 'on'
                      }`}
                    />
                  ) : null}
                </View>


                <View style={{ marginTop: 13, marginBottom: 5 }}>
                  <Text style={styles.brightnessTitle}>
                    Room · {rooms.find((room) => room.id === device.roomId)?.name ?? 'Unassigned'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
                    <Pressable
                      onPress={() => void assignRoom(device, null)}
                      disabled={roomBusy}
                      style={{
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        backgroundColor: device.roomId === null ? '#26765A' : '#F0F2EE',
                        opacity: roomBusy ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: device.roomId === null ? '#FFFFFF' : '#526057' }}>
                        Unassigned
                      </Text>
                    </Pressable>
                    {rooms.map((room) => (
                      <Pressable
                        key={room.id}
                        onPress={() => void assignRoom(device, room.id)}
                        disabled={roomBusy}
                        style={{
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          backgroundColor: device.roomId === room.id ? '#26765A' : '#F0F2EE',
                          opacity: roomBusy ? 0.6 : 1,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: device.roomId === room.id ? '#FFFFFF' : '#526057' }}>
                          {room.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {device.supportsBrightness ? (
                  <View style={styles.brightnessArea}>
                    <View style={styles.brightnessLabels}>
                      <Text style={styles.brightnessTitle}>Brightness</Text>
                      <Text style={styles.brightnessValue}>
                        {Math.round((brightness / 254) * 100)}%
                      </Text>
                    </View>
                    <Slider
                      minimumValue={device.brightnessRange?.min ?? 0}
maximumValue={device.brightnessRange?.max ?? 254}
                      step={1}
                      value={brightness}
                      disabled={isBusy}
                      minimumTrackTintColor="#26765A"
                      maximumTrackTintColor="#E0E5E0"
                      thumbTintColor="#26765A"
                      onSlidingComplete={(value) =>
                        void sendCommand(device, {
                          brightness: Math.round(value),
                        })
                      }
                      accessibilityLabel={`${device.name} brightness`}
                    />
                  </View>
                ) : null}

                {device.supportsColorTemperature ? (
                  <View style={styles.brightnessArea}>
                    <View style={styles.brightnessLabels}>
                      <Text style={styles.brightnessTitle}>Light warmth</Text>
                      <Text style={styles.brightnessValue}>
                        {kelvin.toLocaleString()} K
                      </Text>
                    </View>
                    <Slider
                      minimumValue={device.colorTemperatureRange?.min ?? 153}
maximumValue={device.colorTemperatureRange?.max ?? 454}
                      step={1}
                      value={colorTemp}
                      disabled={isBusy}
                      minimumTrackTintColor="#26765A"
                      maximumTrackTintColor="#E0E5E0"
                      thumbTintColor="#26765A"
                      onSlidingComplete={(value) =>
                        void sendCommand(device, {
                          color_temp: Math.round(value),
                        })
                      }
                      accessibilityLabel={`${device.name} light warmth`}
                    />
                    <View style={styles.brightnessLabels}>
                      <Text style={styles.deviceStatus}>Cool white</Text>
                      <Text style={styles.deviceStatus}>Warm white</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>Connection settings</Text>
          <Text style={styles.settingsDescription}>
            Address of the computer running OpenHome API
          </Text>
          <TextInput
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.10:3000"
            placeholderTextColor="#8B928D"
            style={styles.urlInput}
            accessibilityLabel="OpenHome API address"
          />
          <Pressable
            onPress={() => void refresh()}
            style={styles.connectButton}
            accessibilityRole="button"
          >
            <Text style={styles.connectButtonText}>Save and connect</Text>
          </Pressable>
          <Text style={styles.hint}>
            Simulator: use 127.0.0.1. Physical iPhone: use your Mac’s local
            network IP. Keep both devices on the same network.
          </Text>
        </View>

        <Text style={styles.footer}>OPEN SOURCE · LOCAL FIRST</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6F2',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  eyebrow: {
    color: '#26765A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 7,
  },
  title: {
    color: '#19251F',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  subtitle: {
    color: '#737D75',
    fontSize: 14,
    marginTop: 4,
  },
  refreshButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#26765A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshText: {
    color: '#FFFFFF',
    fontSize: 29,
    lineHeight: 34,
  },
  statusCard: {
    backgroundColor: '#E6F1E9',
    borderRadius: 20,
    padding: 18,
    marginBottom: 26,
  },
  statusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusTitle: {
    color: '#214B37',
    fontSize: 15,
    fontWeight: '700',
  },
  statusDescription: {
    color: '#496B56',
    fontSize: 13,
    marginTop: 9,
  },
  updatedText: {
    color: '#69836F',
    fontSize: 11,
    marginTop: 7,
  },
  errorCard: {
    backgroundColor: '#FCECE8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  errorTitle: {
    color: '#923E31',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 5,
  },
  errorText: {
    color: '#923E31',
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 14,
    gap: 10,
  },
  sectionTitle: {
    color: '#202B24',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  deviceCount: {
    overflow: 'hidden',
    color: '#53665A',
    backgroundColor: '#E5E9E3',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: '700',
  },
  deviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: '#E9ECE7',
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulbIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: '#F0F2ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulbIconOn: {
    backgroundColor: '#FFF2CF',
  },
  bulbEmoji: {
    color: '#B28B37',
    fontSize: 25,
  },
  deviceInfo: {
    flex: 1,
    marginLeft: 13,
    marginRight: 7,
  },
  deviceName: {
    color: '#202B24',
    fontSize: 16,
    fontWeight: '700',
  },
  deviceModel: {
    color: '#7C857E',
    fontSize: 11,
    marginTop: 4,
  },
  deviceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  deviceStatus: {
    color: '#667168',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  brightnessArea: {
    borderTopWidth: 1,
    borderTopColor: '#F0F1EE',
    marginTop: 17,
    paddingTop: 14,
  },
  brightnessLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brightnessTitle: {
    color: '#5D685F',
    fontSize: 13,
    fontWeight: '600',
  },
  brightnessValue: {
    color: '#26765A',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    color: '#26765A',
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#26352B',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyDescription: {
    color: '#788179',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 7,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E9ECE7',
  },
  settingsTitle: {
    color: '#202B24',
    fontSize: 16,
    fontWeight: '800',
  },
  settingsDescription: {
    color: '#788179',
    fontSize: 12,
    marginTop: 7,
    marginBottom: 13,
  },
  urlInput: {
    backgroundColor: '#F5F6F2',
    borderWidth: 1,
    borderColor: '#E0E5DF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#25342A',
    fontSize: 14,
  },
  connectButton: {
    backgroundColor: '#26765A',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 11,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    color: '#7A837C',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 12,
  },
  footer: {
    color: '#9AA199',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 27,
  },
});
