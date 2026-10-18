import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeLatestReading } from '../data/deviceFeed';
import { mergeReadings, NO_READINGS } from '../data/placement';
import { useSettings } from './SettingsContext';

const UNREGISTERED = {
  readings: NO_READINGS,
  updatedAt: null,
  status: 'unregistered',
  error: null,
};

const SensorContext = createContext(null);

export function SensorProvider({ children }) {
  const { devices } = useSettings();
  // Re-subscribe only when the set of nodes or their placements actually
  // change, not on every settings write.
  const key = devices.map((d) => `${d.id}:${d.placement}`).join(',');

  const [per, setPer] = useState({});
  const [errored, setErrored] = useState({});
  const perRef = useRef(per);
  perRef.current = per;

  useEffect(() => {
    setPer({});
    setErrored({});
    if (devices.length === 0) return undefined;

    const unsubscribes = devices.map((device) =>
      subscribeLatestReading(device, ({ reading, at, error }) => {
        if (error) {
          setErrored((prev) => ({ ...prev, [device.id]: error }));
          return;
        }
        setErrored((prev) => {
          if (!prev[device.id]) return prev;
          const next = { ...prev };
          delete next[device.id];
          return next;
        });
        setPer((prev) => ({ ...prev, [device.id]: { reading, at, placement: device.placement } }));
      })
    );
    return () => unsubscribes.forEach((off) => off && off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const value = useMemo(() => {
    if (devices.length === 0) {
      return { ...UNREGISTERED, devices, sources: {} };
    }
    const { readings, updatedAt, sources } = mergeReadings(devices, per);
    const answered = devices.filter((d) => per[d.id]);
    const errors = devices.filter((d) => errored[d.id]);

    // `status` is what the UI tells the user about the feed itself:
    //   unregistered - no node registered, so there is nothing to read
    //   connecting   - waiting for the first snapshot
    //   ok           - showing at least one real sample
    //   empty        - connected, but no node has ever published
    //   error        - every node failed (permission denied / offline)
    let status = 'connecting';
    if (updatedAt != null) status = 'ok';
    else if (errors.length === devices.length) status = 'error';
    else if (answered.length === devices.length) status = 'empty';

    return {
      readings,
      updatedAt,
      status,
      error: errors.length ? errored[errors[0].id] : null,
      devices,
      sources,
    };
  }, [devices, per, errored]);

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
