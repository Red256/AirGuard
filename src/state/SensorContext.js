import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeLatestReading } from '../data/deviceFeed';
import { useSettings } from './SettingsContext';

// Demo scenarios, used when settings.source is 'demo'. The live path reads the
// SEN66 node through Firebase instead; see ../data/deviceFeed.js.
export const SCENARIOS = {
  ventilate: { name: 'Ventilate Now', co2: 1350, pmIndoor: 8, pmOutdoor: 5, temp: 72, rh: 28 },
  closed: { name: 'Keep Windows Closed', co2: 720, pmIndoor: 20, pmOutdoor: 63, temp: 72, rh: 28 },
  indoor: { name: 'Ventilate and Check Indoor Sources', co2: 760, pmIndoor: 38, pmOutdoor: 6, temp: 72, rh: 28 },
  cooking: { name: 'Cooking Indoors (2 alerts)', co2: 1250, pmIndoor: 42, pmOutdoor: 7, temp: 75, rh: 28 },
  fair: { name: 'Fair Air (Moderate, no alerts)', co2: 720, pmIndoor: 8, pmOutdoor: 20, temp: 74, rh: 28 },
  good: { name: 'All Good', co2: 720, pmIndoor: 7, pmOutdoor: 5, temp: 72, rh: 28 },
};

const jitter = (value, pct) => value * (1 + (Math.random() * 2 - 1) * pct);

function makeReading(base) {
  return {
    co2: Math.round(jitter(base.co2, 0.012)),
    pmIndoor: Math.max(1, Math.round(jitter(base.pmIndoor, 0.06))),
    pmOutdoor: Math.max(1, Math.round(jitter(base.pmOutdoor, 0.03))),
    temp: Math.round(base.temp + (Math.random() * 2 - 1)),
    rh: Math.round(base.rh + (Math.random() * 2 - 1)),
  };
}

// Nothing has been read yet. Every channel is 'No data' rather than zero.
const NO_READINGS = { co2: null, pmIndoor: null, pmOutdoor: null, temp: null, rh: null };

const SensorContext = createContext(null);

export function SensorProvider({ children }) {
  const { settings } = useSettings();
  const live = settings.source !== 'demo';
  const base = SCENARIOS[settings.scenario] || SCENARIOS.ventilate;

  // `status` is what the UI tells the user about the feed itself:
  //   connecting - waiting for the first snapshot
  //   ok         - showing a real sample
  //   empty      - connected, but the device has never published
  //   error      - permission denied / offline / malformed sample
  //   demo       - simulated readings
  const [state, setState] = useState(() =>
    live
      ? { readings: NO_READINGS, updatedAt: null, status: 'connecting', error: null, live: true }
      : { readings: makeReading(base), updatedAt: Date.now(), status: 'demo', error: null, live: false }
  );

  useEffect(() => {
    if (!live) {
      const refresh = () =>
        setState({
          readings: makeReading(base),
          updatedAt: Date.now(),
          status: 'demo',
          error: null,
          live: false,
        });
      refresh();
      const id = setInterval(refresh, Math.max(5, settings.updateSeconds) * 1000);
      return () => clearInterval(id);
    }

    // Keep whatever is on screen while reconnecting, so switching back to live
    // does not blank the cards.
    setState((prev) => ({
      readings: prev.live ? prev.readings : NO_READINGS,
      updatedAt: prev.live ? prev.updatedAt : null,
      status: 'connecting',
      error: null,
      live: true,
    }));

    return subscribeLatestReading(({ reading, at, error }) => {
      if (error) {
        setState((prev) => ({ ...prev, status: 'error', error, live: true }));
        return;
      }
      if (!reading) {
        setState({ readings: NO_READINGS, updatedAt: null, status: 'empty', error: null, live: true });
        return;
      }
      setState({ readings: reading, updatedAt: at, status: 'ok', error: null, live: true });
    });
  }, [live, base, settings.updateSeconds]);

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
