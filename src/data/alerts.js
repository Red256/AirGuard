import { levelFor } from './levels';

export const ALERT_METRICS = ['pmOutdoor', 'pmIndoor', 'co2'];

// Per-metric wording. `kind` is the STATUS_CONTENT key shown on the suggestion page.
export const ALERT_META = {
  pmOutdoor: {
    title: 'Unhealthy outdoor PM2.5 level',
    action: 'Keep windows closed',
    kind: 'closed',
    label: 'Outdoor PM2.5',
    unit: 'µg/m³',
  },
  pmIndoor: {
    title: 'Unhealthy indoor PM2.5 level',
    action: 'Ventilate and check indoor sources',
    kind: 'indoor',
    label: 'Indoor PM2.5',
    unit: 'µg/m³',
  },
  co2: {
    title: 'Unhealthy indoor CO₂ level',
    action: 'Open window to ventilate',
    kind: 'ventilate',
    label: 'Indoor CO₂',
    unit: 'ppm',
  },
};

// Keeps a log of alert events: one open event per metric while the reading is Unhealthy.
// Only Unhealthy readings raise an alert. An event closes when the reading is Moderate or Good again.
const STALE_MS = 10 * 60 * 1000;

export function applyReadings(events, readings, thresholds, now) {
  let changed = false;
  const next = events.map((e) => ({ ...e }));

  // An event left open by a previous session is closed where we last saw it.
  for (const e of next) {
    if (e.endedAt == null && now - (e.lastSeen || e.startedAt) > STALE_MS) {
      e.endedAt = e.lastSeen || e.startedAt;
      changed = true;
    }
  }

  for (const metric of ALERT_METRICS) {
    const value = readings[metric];
    const open = next.find((e) => e.metric === metric && e.endedAt == null);
    if (levelFor(metric, value, thresholds) === 'bad') {
      if (!open) {
        next.push({
          id: `${metric}-${now}`,
          metric,
          startedAt: now,
          endedAt: null,
          lastSeen: now,
          peak: value,
          peakLevel: levelFor(metric, value, thresholds),
          // All readings at the moment this alert was at its worst, for the past-alert panel.
          peakAt: now,
          snapshot: { ...readings },
        });
      } else {
        open.lastSeen = now;
        if (value > open.peak) {
          open.peak = value;
          open.peakLevel = levelFor(metric, value, thresholds);
          open.peakAt = now;
          open.snapshot = { ...readings };
        }
      }
      changed = true;
    } else if (open) {
      open.endedAt = now;
      changed = true;
    }
  }

  // Past alerts only cover earlier days: an alert that started and ended today is not kept.
  const today = dayKey(now);
  const kept = next.filter((e) => !(e.endedAt != null && dayKey(e.startedAt) === today));
  if (kept.length !== next.length) changed = true;

  return changed ? kept : events;
}

// Sample past alerts so the history isn't empty on first launch (sensor data here is simulated).
export function seedEvents(now) {
  const h = 60 * 60 * 1000;
  const d = 24 * h;
  const make = (metric, startAgo, durationH, peak, peakLevel, snapshot) => ({
    id: `seed-${metric}-${startAgo}`,
    metric,
    startedAt: now - startAgo,
    endedAt: now - startAgo + durationH * h,
    lastSeen: now - startAgo + durationH * h,
    peak,
    peakLevel,
    peakAt: now - startAgo + durationH * h * 0.55,
    snapshot,
  });
  // Alerts are rare: a few Unhealthy events spread over the past month.
  return [
    make('pmOutdoor', 3 * d + 7 * h, 2.1, 54, 'bad', { co2: 705, pmIndoor: 9, pmOutdoor: 54 }),
    make('co2', 11 * d + 9 * h, 3, 1410, 'bad', { co2: 1410, pmIndoor: 10, pmOutdoor: 8 }),
    make('pmIndoor', 24 * d + 6 * h, 1.2, 47, 'bad', { co2: 905, pmIndoor: 47, pmOutdoor: 9 }),
  ];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(ts, now = Date.now()) {
  if (dayKey(ts) === dayKey(now)) return 'Today';
  if (dayKey(ts) === dayKey(now - 24 * 60 * 60 * 1000)) return 'Yesterday';
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatDuration(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatAgo(ts, now = Date.now()) {
  const minutes = Math.round((now - ts) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.round(minutes / 60);
  return h === 1 ? '1 hour ago' : `${h} hours ago`;
}
