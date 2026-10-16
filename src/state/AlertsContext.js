import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyReadings, seedEvents } from '../data/alerts';
import { useSensors } from './SensorContext';
import { useSettings } from './SettingsContext';

const STORAGE_KEY = 'airguard.alerts.v3';
const MAX_EVENTS = 100;

const AlertsContext = createContext({ current: [], past: [] });

export function AlertsProvider({ children }) {
  const { settings } = useSettings();
  const { readings, updatedAt } = useSensors();
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    (async () => {
      let initial = null;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) initial = JSON.parse(raw);
      } catch (e) {
        // Start fresh if storage is unavailable or corrupt.
      }
      if (!Array.isArray(initial)) {
        initial = seedEvents(Date.now());
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initial)).catch(() => {});
      }
      setEvents(initial);
      setLoaded(true);
    })();
  }, []);

  // Open, update or close alert events whenever a new reading arrives.
  useEffect(() => {
    if (!loaded) return;
    const next = applyReadings(eventsRef.current, readings, settings.thresholds, updatedAt);
    if (next !== eventsRef.current) {
      const trimmed = next
        .slice()
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, MAX_EVENTS);
      setEvents(trimmed);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)).catch(() => {});
    }
  }, [loaded, readings, updatedAt, settings.thresholds]);

  const value = useMemo(() => {
    const sorted = events.slice().sort((a, b) => b.startedAt - a.startedAt);
    const current = sorted
      .filter((e) => e.endedAt == null)
      .sort((a, b) => b.startedAt - a.startedAt);
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const past = sorted.filter((e) => e.endedAt != null && e.startedAt < todayStart);
    return { current, past };
  }, [events]);

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  return useContext(AlertsContext);
}
