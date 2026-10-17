import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyReadings, seedEvents } from '../data/alerts';
import { useSensors } from './SensorContext';
import { useSettings } from './SettingsContext';

// The live log and the demo log are kept apart, so seeded demo history never
// shows up next to real alerts from the node (and vice versa).
const STORAGE_KEY = 'airguard.alerts.v4';
const storageKeyFor = (source) => `${STORAGE_KEY}.${source}`;
const MAX_EVENTS = 100;

const AlertsContext = createContext({ current: [], past: [] });

export function AlertsProvider({ children }) {
  const { settings } = useSettings();
  const { readings, updatedAt, status } = useSensors();
  const source = settings.source === 'demo' ? 'demo' : 'live';
  const [events, setEvents] = useState([]);
  const [loadedSource, setLoadedSource] = useState(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = storageKeyFor(source);
      let initial = null;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) initial = JSON.parse(raw);
      } catch (e) {
        // Start fresh if storage is unavailable or corrupt.
      }
      if (!Array.isArray(initial)) {
        // Only the demo log is pre-populated. A real log starts empty and fills
        // from the node, because inventing alerts that never happened would
        // make the history untrustworthy.
        initial = source === 'demo' ? seedEvents(Date.now()) : [];
        AsyncStorage.setItem(key, JSON.stringify(initial)).catch(() => {});
      }
      if (cancelled) return;
      setEvents(initial);
      setLoadedSource(source);
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  // Open, update or close alert events whenever a new reading arrives.
  useEffect(() => {
    if (loadedSource !== source) return;
    // No timestamp means no sample has landed yet; there is nothing to grade.
    if (updatedAt == null || status === 'error') return;
    const next = applyReadings(eventsRef.current, readings, settings.thresholds, updatedAt);
    if (next !== eventsRef.current) {
      const trimmed = next
        .slice()
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, MAX_EVENTS);
      setEvents(trimmed);
      AsyncStorage.setItem(storageKeyFor(source), JSON.stringify(trimmed)).catch(() => {});
    }
  }, [loadedSource, source, readings, updatedAt, status, settings.thresholds]);

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
