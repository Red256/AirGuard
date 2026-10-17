// Every reading has three levels: Good, Moderate and Unhealthy.
// Alerts and "tap for a suggestion" only happen when a reading is Unhealthy.
//
// Air readings use two cutoffs: at or below `good` is Good, at or below `moderate` is Moderate,
// anything above that is Unhealthy.
export const BANDS = {
  co2: { good: 800, moderate: 1200 }, // ppm
  pmIndoor: { good: 12, moderate: 35 }, // µg/m³
  pmOutdoor: { good: 12, moderate: 35 }, // µg/m³
};

// Temperature and humidity have a Good range; outside it is Moderate for a short distance, then Unhealthy.
export const TEMP_BAND = { goodMin: 64, goodMax: 77, margin: 6 }; // °F
export const HUMIDITY_BAND = { goodMin: 30, goodMax: 60, margin: 10 }; // %

export const DEFAULT_THRESHOLDS = BANDS;

export const METRICS = {
  co2: { label: 'Indoor CO₂', unit: 'ppm' },
  pmIndoor: { label: 'Indoor PM2.5', unit: 'µg/m³' },
  pmOutdoor: { label: 'Outdoor PM2.5', unit: 'µg/m³' },
};

// 'none' is a fourth, non-grade state: the sensor did not report that channel.
// A real node drops channels while it warms up, and outdoor PM2.5 has no source
// at all, so every screen has to be able to render "no reading" without
// pretending the value is 0.
export const LEVEL_LABEL = { good: 'Good', moderate: 'Moderate', bad: 'Unhealthy', none: 'No data' };

const isReading = (value) => typeof value === 'number' && isFinite(value);

export function levelFor(metric, value, thresholds = BANDS) {
  const band = thresholds[metric];
  if (!band || !isReading(value)) return 'none';
  if (value <= band.good) return 'good';
  if (value <= band.moderate) return 'moderate';
  return 'bad';
}

function bandLevel(value, { goodMin, goodMax, margin }) {
  if (!isReading(value)) return 'none';
  if (value >= goodMin && value <= goodMax) return 'good';
  const distance = value < goodMin ? goodMin - value : value - goodMax;
  return distance <= margin ? 'moderate' : 'bad';
}

// `note` says which way a reading is off (Cool, Warm, Dry, Humid) and is null when Good.
export function temperatureLabel(tempF) {
  const level = bandLevel(tempF, TEMP_BAND);
  const note = level === 'good' || level === 'none' ? null : tempF < TEMP_BAND.goodMin ? 'Cool' : 'Warm';
  return { level, label: LEVEL_LABEL[level], palette: level, note };
}

export function humidityLabel(rh) {
  const level = bandLevel(rh, HUMIDITY_BAND);
  const note = level === 'good' || level === 'none' ? null : rh < HUMIDITY_BAND.goodMin ? 'Dry' : 'Humid';
  return { level, label: LEVEL_LABEL[level], palette: level, note };
}

export function toDisplayTemp(tempF, unit) {
  if (!isReading(tempF)) return null;
  return unit === 'C' ? Math.round(((tempF - 32) * 5) / 9) : Math.round(tempF);
}

// How a value is written on a card: thousands separated, rounded the way each
// metric is read, and an em dash when the channel reported nothing.
export function formatValue(metric, value) {
  if (!isReading(value)) return '—';
  const decimals = metric === 'pmIndoor' || metric === 'pmOutdoor' ? 1 : 0;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Decides what the suggestion page should say when no specific reading was tapped.
//   closed             - outdoor PM2.5 is Unhealthy: keep windows shut
//   indoor             - indoor PM2.5 is Unhealthy: look for indoor sources
//   ventilate          - CO2 is Unhealthy and outdoor air is fine: open a window
//   ventilateUnchecked - CO2 is Unhealthy but outdoor PM2.5 is unknown
//   good               - nothing is Unhealthy
export function evaluate(readings, thresholds = BANDS) {
  if (levelFor('pmOutdoor', readings.pmOutdoor, thresholds) === 'bad') return 'closed';
  if (levelFor('pmIndoor', readings.pmIndoor, thresholds) === 'bad') return 'indoor';
  if (levelFor('co2', readings.co2, thresholds) === 'bad') return ventilateKind(readings, thresholds);
  return 'good';
}

// Telling someone to open a window is only safe advice if we know the air
// outside is clean. Without an outdoor reading we say so instead of claiming it.
function ventilateKind(readings, thresholds) {
  return levelFor('pmOutdoor', readings.pmOutdoor, thresholds) === 'none' ? 'ventilateUnchecked' : 'ventilate';
}

// What to do about one reading the user tapped. Returns a STATUS_CONTENT key,
// or null when that reading is not Unhealthy (nothing to suggest).
export function suggestionFor(metric, readings, thresholds = BANDS) {
  if (!METRICS[metric] || levelFor(metric, readings[metric], thresholds) !== 'bad') return null;
  if (metric === 'pmOutdoor') return 'closed';
  if (metric === 'pmIndoor') return 'indoor';
  if (levelFor('pmOutdoor', readings.pmOutdoor, thresholds) === 'bad') return 'closed';
  return ventilateKind(readings, thresholds);
}

export const STATUS_CONTENT = {
  ventilate: {
    palette: 'good',
    icon: 'leaf',
    title: 'VENTILATE NOW',
    shortTitle: 'Ventilate Now',
    message: 'Indoor CO₂ is elevated\nand outdoor air is clean.\nConsider opening a window.',
    info: 'Outdoor air is cleaner than indoor air. Opening windows can help reduce CO₂ levels.',
    learn: {
      title: 'Why open a window?',
      body:
        'CO₂ builds up indoors from breathing, especially in closed rooms. Levels above about 1,000 ppm can make rooms feel stuffy and cause drowsiness or trouble concentrating.\n\nRight now the air outside has low particle pollution, so opening a window for 5–10 minutes is a quick way to bring CO₂ back down.',
    },
  },
  // Same situation as `ventilate`, minus the one fact that makes opening a
  // window unambiguously right. Shown whenever outdoor PM2.5 has no source.
  ventilateUnchecked: {
    palette: 'moderate',
    icon: 'leaf',
    title: 'VENTILATE\nIF YOU CAN',
    shortTitle: 'Ventilate If You Can',
    message: 'Indoor CO₂ is elevated.\nOutdoor air quality is unknown,\nso check before opening up.',
    info: 'AirGuard has no outdoor sensor connected, so it cannot confirm the air outside is clean.',
    learn: {
      title: 'Why the hedge?',
      body:
        'CO₂ builds up indoors from breathing, and the fix is fresh air. But fresh air is only an improvement when the air outside is clean — during wildfire smoke or heavy traffic, opening a window trades stale air for fine particles.\n\nThis node measures indoor air only. Check a local air quality forecast, or look outside for haze and smell for smoke, then ventilate for 5–10 minutes if it looks clear. Connect an outdoor sensor and AirGuard will make this call for you.',
    },
  },
  closed: {
    palette: 'bad',
    icon: 'warning',
    title: 'KEEP WINDOWS\nCLOSED',
    shortTitle: 'Keep Windows Closed',
    message: 'Outdoor PM2.5 is high.\nAvoid bringing outdoor air inside.',
    info: 'Outdoor particle pollution is elevated right now. Keep windows closed and use filtration if available.',
    learn: {
      title: 'Why keep windows closed?',
      body:
        'PM2.5 are fine particles from smoke, traffic and dust that can reach deep into your lungs. When outdoor PM2.5 is high, opening a window lets those particles inside.\n\nKeep windows and doors shut, set your HVAC to recirculate, and run an air purifier with a HEPA filter if you have one. Check back later; this advice updates automatically.',
    },
  },
  indoor: {
    palette: 'moderate',
    icon: 'warning',
    title: 'REDUCE INDOOR\nSOURCES',
    shortTitle: 'Reduce Indoor Sources',
    message: 'Indoor PM2.5 is high.\nIndoor particle levels are much\nhigher than outdoors.',
    info: null,
    learn: null,
  },
  good: {
    palette: 'good',
    icon: 'leaf',
    title: 'AIR IS GOOD',
    message: 'Indoor and outdoor air quality\nlook healthy right now.\nNo action needed.',
    info: 'Nothing is unhealthy right now. We will alert you if a reading becomes unhealthy.',
    learn: {
      title: 'All readings look good',
      body:
        'None of your readings are unhealthy right now. AirGuard will alert you if that changes.',
    },
  },
};

export const INDOOR_ACTIONS = [
  'Check cooking fumes',
  'Avoid smoke and candles',
  'Use kitchen exhaust if available',
  'Ventilate if outdoor air remains clean',
];

export const INDOOR_SOURCES_TEXT =
  'Cooking, smoke, candles, and other indoor sources can increase particle levels inside your home.';

export const METRIC_INFO = {
  co2: {
    title: 'Indoor CO₂',
    body: 'Carbon dioxide in parts per million (ppm). Outdoor air is about 420 ppm. Above roughly 1,000 ppm, rooms feel stuffy and ventilation is recommended.',
  },
  pmIndoor: {
    title: 'Indoor PM2.5',
    body: 'Fine particles smaller than 2.5 micrometers, in µg/m³. Cooking, smoke and candles are common indoor sources. Lower is better.',
  },
  pmOutdoor: {
    title: 'Outdoor PM2.5',
    body: 'Fine particles in the outdoor air, in µg/m³. Wildfire smoke, traffic and dust raise this number. When it is high, keep windows closed.',
  },
};
