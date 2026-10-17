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

export const DEFAULT_THRESHOLDS = BANDS;

export const METRICS = {
  co2: { label: 'Indoor CO₂', unit: 'ppm' },
  pmIndoor: { label: 'Indoor PM2.5', unit: 'µg/m³' },
  pmOutdoor: { label: 'Outdoor PM2.5', unit: 'µg/m³' },
};

export const LEVEL_LABEL = { good: 'Good', moderate: 'Moderate', bad: 'Unhealthy' };

export function levelFor(metric, value, thresholds = BANDS) {
  const band = thresholds[metric];
  if (value <= band.good) return 'good';
  if (value <= band.moderate) return 'moderate';
  return 'bad';
}

// Decides what the suggestion page should say when no specific reading was tapped.
//   closed    - outdoor PM2.5 is Unhealthy: keep windows shut
//   indoor    - indoor PM2.5 is Unhealthy: look for indoor sources
//   ventilate - CO2 is Unhealthy and outdoor air is fine: open a window
//   good      - nothing is Unhealthy
export function evaluate(readings, thresholds = BANDS) {
  if (levelFor('pmOutdoor', readings.pmOutdoor, thresholds) === 'bad') return 'closed';
  if (levelFor('pmIndoor', readings.pmIndoor, thresholds) === 'bad') return 'indoor';
  if (levelFor('co2', readings.co2, thresholds) === 'bad') return 'ventilate';
  return 'good';
}

// What to do about one reading the user tapped. Returns a STATUS_CONTENT key,
// or null when that reading is not Unhealthy (nothing to suggest).
export function suggestionFor(metric, readings, thresholds = BANDS) {
  if (!METRICS[metric] || levelFor(metric, readings[metric], thresholds) !== 'bad') return null;
  if (metric === 'pmOutdoor') return 'closed';
  if (metric === 'pmIndoor') return 'indoor';
  return levelFor('pmOutdoor', readings.pmOutdoor, thresholds) === 'bad' ? 'closed' : 'ventilate';
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
    title: 'VENTILATE AND CHECK\nINDOOR SOURCES',
    shortTitle: 'Ventilate and Check Indoor Sources',
    message: 'Indoor PM2.5 is high.\nIndoor PM2.5 levels are much\nhigher than outdoors.',
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
  'Cooking, smoke, candles, and other indoor sources can increase PM2.5 levels inside your home.';

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
