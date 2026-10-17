import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_THRESHOLDS } from '../data/levels';

const STORAGE_KEY = 'airguard.settings.v1';

export const DEFAULT_SETTINGS = {
  thresholds: DEFAULT_THRESHOLDS,
  updateSeconds: 60,
  // The registered node's Particle device id, or null before registration.
  // Every reading the app shows comes from this one device; there is no
  // simulated mode, so nothing is displayed until a device is registered.
  deviceId: null,
};

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
            deviceId: typeof saved.deviceId === 'string' ? saved.deviceId : null,
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

  const registerDevice = useCallback((deviceId) => update({ deviceId }), [update]);
  const forgetDevice = useCallback(() => update({ deviceId: null }), [update]);

  const value = useMemo(
    () => ({ settings, update, registerDevice, forgetDevice, registered: settings.deviceId != null }),
    [settings, update, registerDevice, forgetDevice]
  );

  if (!loaded) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
