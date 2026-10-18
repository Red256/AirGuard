import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_THRESHOLDS } from '../data/levels';

const STORAGE_KEY = 'airguard.settings.v1';

export const PLACEMENTS = ['indoor', 'outdoor'];

export const PLACEMENT_LABEL = { indoor: 'Indoor', outdoor: 'Outdoor' };

export const DEFAULT_SETTINGS = {
  thresholds: DEFAULT_THRESHOLDS,
  updateSeconds: 60,
  // Registered nodes, each { id, placement }. Placement decides which readings
  // a node contributes: an indoor node supplies CO₂ and indoor PM2.5, an
  // outdoor node supplies outdoor PM2.5. There is no simulated mode, so the
  // app shows nothing until at least one node is registered.
  devices: [],
};

const isPlacement = (value) => PLACEMENTS.includes(value);

// Accepts both shapes storage can hold: the current `devices` array, and the
// single `deviceId` string written before placement existed. An upgraded
// install keeps its node and is assumed indoor, which is what it was.
function readDevices(saved) {
  if (Array.isArray(saved.devices)) {
    const byId = new Map();
    for (const d of saved.devices) {
      if (!d || typeof d.id !== 'string') continue;
      byId.set(d.id, { id: d.id, placement: isPlacement(d.placement) ? d.placement : 'indoor' });
    }
    return [...byId.values()];
  }
  if (typeof saved.deviceId === 'string') return [{ id: saved.deviceId, placement: 'indoor' }];
  return [];
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setSettings({
            ...DEFAULT_SETTINGS,
            // Only keys the app still understands. Installs from before device
            // registration stored `source`/`scenario` for the simulated mode,
            // which no longer exists; dropping them here keeps that dead state
            // from riding along in storage forever.
            updateSeconds: saved.updateSeconds ?? DEFAULT_SETTINGS.updateSeconds,
            devices: readDevices(saved),
            thresholds: DEFAULT_THRESHOLDS,
          });
        }
      } catch (e) {
        // Fall back to defaults if storage is unavailable or corrupt.
      }
      setLoaded(true);
    })();
  }, []);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setDevices = useCallback(
    (fn) => setSettings((prev) => {
      const next = { ...prev, devices: fn(prev.devices) };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    }),
    []
  );

  // Registering an id that is already registered moves it to the new placement
  // rather than listing the same node twice.
  const addDevice = useCallback(
    (id, placement = 'indoor') =>
      setDevices((devices) => [
        ...devices.filter((d) => d.id !== id),
        { id, placement: isPlacement(placement) ? placement : 'indoor' },
      ]),
    [setDevices]
  );

  const removeDevice = useCallback(
    (id) => setDevices((devices) => devices.filter((d) => d.id !== id)),
    [setDevices]
  );

  const setPlacement = useCallback(
    (id, placement) =>
      setDevices((devices) =>
        devices.map((d) => (d.id === id ? { ...d, placement: isPlacement(placement) ? placement : d.placement } : d))
      ),
    [setDevices]
  );

  const value = useMemo(
    () => ({
      settings,
      update,
      devices: settings.devices,
      addDevice,
      removeDevice,
      setPlacement,
      registered: settings.devices.length > 0,
    }),
    [settings, update, addDevice, removeDevice, setPlacement]
  );

  if (!loaded) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
