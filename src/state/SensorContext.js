import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSettings } from './SettingsContext';

// Simulated sensors. Swap makeReading() for a real sensor / API call when hardware exists.
export const SCENARIOS = {
  ventilate: { name: 'Ventilate Now', co2: 1350, pmIndoor: 8, pmOutdoor: 5, temp: 72, rh: 46 },
  closed: { name: 'Keep Windows Closed', co2: 1080, pmIndoor: 12, pmOutdoor: 63, temp: 72, rh: 46 },
  indoor: { name: 'Reduce Indoor Sources', co2: 760, pmIndoor: 38, pmOutdoor: 6, temp: 72, rh: 46 },
  cooking: { name: 'Cooking Indoors (2 alerts)', co2: 1250, pmIndoor: 42, pmOutdoor: 7, temp: 75, rh: 52 },
  fair: { name: 'Fair Air (Moderate, no alerts)', co2: 980, pmIndoor: 20, pmOutdoor: 18, temp: 79, rh: 66 },
  good: { name: 'All Good', co2: 720, pmIndoor: 7, pmOutdoor: 5, temp: 72, rh: 46 },
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

const SensorContext = createContext(null);

export function SensorProvider({ children }) {
  const { settings } = useSettings();
  const base = SCENARIOS[settings.scenario] || SCENARIOS.ventilate;
  const [state, setState] = useState(() => ({ readings: makeReading(base), updatedAt: Date.now() }));

  useEffect(() => {
    const refresh = () => setState({ readings: makeReading(base), updatedAt: Date.now() });
    refresh();
    const id = setInterval(refresh, settings.updateSeconds * 1000);
    return () => clearInterval(id);
  }, [base, settings.updateSeconds]);

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
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}
