import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeLatestReading } from '../data/deviceFeed';
import { useSettings } from './SettingsContext';

// Nothing has been read yet. Every channel is 'No data' rather than zero.
const NO_READINGS = { co2: null, pmIndoor: null, pmOutdoor: null, temp: null, rh: null };

const SensorContext = createContext(null);

const UNREGISTERED = { readings: NO_READINGS, updatedAt: null, status: 'unregistered', error: null };

export function SensorProvider({ children }) {
  const { settings } = useSettings();
  const deviceId = settings.deviceId;

  // `status` is what the UI tells the user about the feed itself:
  //   unregistered - no device registered yet, so there is nothing to read
  //   connecting   - waiting for the first snapshot
  //   ok           - showing a real sample
  //   empty        - connected, but the device has never published
  //   error        - permission denied / offline / malformed sample
  const [state, setState] = useState(() =>
    deviceId ? { readings: NO_READINGS, updatedAt: null, status: 'connecting', error: null } : UNREGISTERED
  );

  useEffect(() => {
    if (!deviceId) {
      setState(UNREGISTERED);
      return undefined;
    }

    // Blank the cards while attaching to a different device, so one node's
    // readings are never shown under another node's id.
    setState({ readings: NO_READINGS, updatedAt: null, status: 'connecting', error: null });

    return subscribeLatestReading(deviceId, ({ reading, at, error }) => {
      if (error) {
        setState((prev) => ({ ...prev, status: 'error', error }));
        return;
      }
      if (!reading) {
        setState({ readings: NO_READINGS, updatedAt: null, status: 'empty', error: null });
        return;
      }
      setState({ readings: reading, updatedAt: at, status: 'ok', error: null });
    });
  }, [deviceId]);

  const value = useMemo(() => state, [state]);
  return <SensorContext.Provider value={value}>{children}</SensorContext.Provider>;
}

export function useSensors() {
  return useContext(SensorContext);
}

export function useRelativeTime(timestamp) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);
  if (timestamp == null) return 'never';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}
