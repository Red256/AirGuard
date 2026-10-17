// Chart data: toSeries() resamples the real samples read from Firebase onto
// the grid the chart draws. It hands the chart a fixed-length array per metric,
// where null means "no reading in this bucket" so gaps in the feed draw as gaps.

export const RANGES = {
  '24h': { label: '24 Hours', points: 96, hoursSpan: 24 },
  '7d': { label: '7 Days', points: 168, hoursSpan: 24 * 7 },
  '30d': { label: '30 Days', points: 240, hoursSpan: 24 * 30 },
};

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

// Labels for a window that ends now, which is what the charts plot.
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

export const CHART_CONFIG = {
  co2: { title: 'Indoor CO₂ (ppm)', color: '#2E9E4B', min: 500, max: 2000, step: 500 },
  pmIndoor: { title: 'Indoor PM2.5 (µg/m³)', color: '#1E73D8', min: 0, max: 60, step: 20 },
  pmOutdoor: { title: 'Outdoor PM2.5 (µg/m³)', color: '#EF6C1A', min: 0, max: 80, step: 20 },
};
