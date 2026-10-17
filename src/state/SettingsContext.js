import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_THRESHOLDS } from '../data/levels';

const STORAGE_KEY = 'airguard.settings.v1';

export const DEFAULT_SETTINGS = {
  thresholds: DEFAULT_THRESHOLDS,
  tempUnit: 'F',
  updateSeconds: 60,
  // 'live'  - readings from the SEN66 node via Firebase
  // 'demo'  - the simulated scenario named by `scenario`
  source: 'live',
  scenario: 'ventilate',
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
            ...saved,
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

  const value = useMemo(() => ({ settings, update }), [settings, update]);

  if (!loaded) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
