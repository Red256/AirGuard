import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyReadings } from '../data/alerts';
import { useSensors } from './SensorContext';
import { useSettings } from './SettingsContext';

// One log for the install. Readings are now merged from several nodes, so an
// alert belongs to the home rather than to any single device; keying it per
// device would split one alert's history across the nodes that saw it.
const STORAGE_KEY = 'airguard.alerts.v5';
const MAX_EVENTS = 100;

const AlertsContext = createContext({ current: [], past: [] });

export function AlertsProvider({ children }) {
  const { settings, registered } = useSettings();
  const { readings, updatedAt, status } = useSensors();
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = STORAGE_KEY;
      let initial = null;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) initial = JSON.parse(raw);
      } catch (e) {
        // Start fresh if storage is unavailable or corrupt.
      }
      // A log starts empty and fills from the node. Inventing alerts that never
      // happened would make the history untrustworthy.
      if (!Array.isArray(initial)) initial = [];
      if (cancelled) return;
      setEvents(initial);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Open, update or close alert events whenever a new reading arrives.
  useEffect(() => {
    if (!loaded || !registered) return;
    // No timestamp means no sample has landed yet; there is nothing to grade.
    if (updatedAt == null || status === 'error') return;
    const next = applyReadings(eventsRef.current, readings, settings.thresholds, updatedAt);
    if (next !== eventsRef.current) {
      const trimmed = next
        .slice()
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, MAX_EVENTS);
      setEvents(trimmed);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)).catch(() => {});
    }
  }, [loaded, registered, readings, updatedAt, status, settings.thresholds]);

  const value = useMemo(() => {
    const sorted = events.slice().sort((a, b) => b.startedAt - a.startedAt);
    const current = sorted.filter((e) => e.endedAt == null);
    const past = sorted.filter((e) => e.endedAt != null);
    return { current, past };
  }, [events]);

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  return useContext(AlertsContext);
}
