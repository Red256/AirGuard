// Chart data, from two sources:
//   toSeries()       - real samples read from Firebase, resampled onto the grid
//   generateSeries() - the deterministic (seeded) simulation, used in demo mode
// Both hand the chart a fixed-length array per metric, where null means "no
// reading in this bucket" so gaps in a real feed draw as gaps.

function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bump = (h, mu, sigma) => Math.exp(-((h - mu) ** 2) / (2 * sigma * sigma));

const PATTERNS = {
  co2: (h) => 620 + 300 * bump(h, 12, 5) + 700 * bump(h, 16, 2.2) + 480 * bump(h, 22.5, 3.5),
  pmIndoor: (h) => 6 + 4 * bump(h, 8, 1.2) + 36 * bump(h, 17.4, 0.4),
  pmOutdoor: (h) => 10 + 12 * bump(h, 10, 4) + 42 * bump(h, 16.5, 2.2),
};

const NOISE = { co2: 40, pmIndoor: 1.2, pmOutdoor: 2.2 };
const SEEDS = { co2: 11, pmIndoor: 23, pmOutdoor: 37 };

export const RANGES = {
  '24h': { label: '24 Hours', points: 96, hoursSpan: 24 },
  '7d': { label: '7 Days', points: 168, hoursSpan: 24 * 7 },
  '30d': { label: '30 Days', points: 240, hoursSpan: 24 * 30 },
};

export function generateSeries(metric, rangeKey) {
  const { points, hoursSpan } = RANGES[rangeKey];
  const rand = rng(SEEDS[metric] + rangeKey.length * 101);
  const dayScale = {};
  const out = [];
  for (let i = 0; i < points; i++) {
    const hoursFromStart = (i / (points - 1)) * hoursSpan;
    const day = Math.floor(hoursFromStart / 24);
    if (dayScale[day] === undefined) dayScale[day] = 0.75 + rand() * 0.5;
    const h = hoursFromStart % 24;
    const base = PATTERNS[metric](rangeKey === '24h' ? hoursFromStart : h);
    const scale = rangeKey === '24h' ? 1 : dayScale[day];
    const value = base * scale + (rand() - 0.5) * 2 * NOISE[metric];
    out.push(Math.max(metric === 'co2' ? 420 : 0, value));
  }
  return out;
}

export const SERIES_METRICS = ['co2', 'pmIndoor', 'pmOutdoor'];

export const rangeStart = (rangeKey, now = Date.now()) =>
  now - RANGES[rangeKey].hoursSpan * 60 * 60 * 1000;

// Resamples real samples onto the fixed grid the chart draws, averaging what
// falls in each bucket and leaving a bucket empty (null) when nothing does.
// Averaging rather than picking the nearest point keeps a 5-minute feed honest
// at the 30-day zoom, where one bucket covers three hours.
export function toSeries(samples, rangeKey, now = Date.now()) {
  const { points } = RANGES[rangeKey];
  const from = rangeStart(rangeKey, now);
  const width = (now - from) / points;
  const sums = {};
  const counts = {};
  SERIES_METRICS.forEach((m) => {
    sums[m] = new Array(points).fill(0);
    counts[m] = new Array(points).fill(0);
  });

  for (const sample of samples) {
    const slot = Math.floor((sample.at - from) / width);
    if (slot < 0 || slot >= points) continue;
    for (const m of SERIES_METRICS) {
      const value = sample.reading[m];
      if (typeof value === 'number' && isFinite(value)) {
        sums[m][slot] += value;
        counts[m][slot] += 1;
      }
    }
  }

  const out = { from, to: now };
  for (const m of SERIES_METRICS) {
    out[m] = sums[m].map((sum, i) => (counts[m][i] ? sum / counts[m][i] : null));
  }
  return out;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HOUR_LABEL = (d) => {
  const h = d.getHours();
  return `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
};

// Labels for a window that ends now, which is what the live charts plot.
// xLabelsFor() below assumes the simulated 24h series starts at midnight, so
// it cannot be reused here.
export function rollingXLabels(rangeKey, now = Date.now()) {
  const from = rangeStart(rangeKey, now);
  const at = (pos) => new Date(from + pos * (now - from));
  if (rangeKey === '24h') {
    return [0, 0.25, 0.5, 0.75, 1].map((pos) => ({ pos, text: HOUR_LABEL(at(pos)) }));
  }
  if (rangeKey === '7d') {
    return Array.from({ length: 7 }, (_, i) => {
      const pos = i / 6;
      return { pos, text: DAY_NAMES[at(pos).getDay()] };
    });
  }
  return [0, 0.25, 0.5, 0.75, 1].map((pos) => {
    const d = at(pos);
    return { pos, text: `${d.getMonth() + 1}/${d.getDate()}` };
  });
}

export function xLabelsFor(rangeKey, now = new Date()) {
  if (rangeKey === '24h') {
    return [
      { pos: 0, text: '12 AM' },
      { pos: 0.25, text: '6 AM' },
      { pos: 0.5, text: '12 PM' },
      { pos: 0.75, text: '6 PM' },
      { pos: 1, text: '12 AM' },
    ];
  }
  if (rangeKey === '7d') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      return { pos: i / 6, text: DAY_NAMES[d.getDay()] };
    });
  }
  return [30, 22, 15, 7, 0].map((daysAgo, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - daysAgo);
    return { pos: i / 4, text: `${d.getMonth() + 1}/${d.getDate()}` };
  });
}

export const CHART_CONFIG = {
  co2: { title: 'Indoor CO₂ (ppm)', color: '#2E9E4B', min: 500, max: 2000, step: 500 },
  pmIndoor: { title: 'Indoor PM2.5 (µg/m³)', color: '#1E73D8', min: 0, max: 60, step: 20 },
  pmOutdoor: { title: 'Outdoor PM2.5 (µg/m³)', color: '#EF6C1A', min: 0, max: 80, step: 20 },
};
