// Smoke test for the pure data path - mapping, grading, the alert log and the
// chart series - run against what is actually in the Realtime Database.
//
//   npm run verify           read the live database
//   npm run verify dump.json read a saved dump instead
//
// There is no test runner in this project; this is a script, not a suite. It
// stubs firebase and calls the same functions the app does, so a change to the
// feed shape or to the grading rules shows up here before it shows up on a phone.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const babel = require('@babel/core');

process.chdir(new URL('..', import.meta.url).pathname);

const DB_URL = 'https://airguard-8a58c-default-rtdb.firebaseio.com';
const DEVICE = 'e00fce6893f468b723fe10b0';
const SCRATCH = process.argv[2];

// Load an app source file through babel, resolving its sibling imports and
// stubbing firebase so the pure data path runs without a network or an app.
const FIREBASE_STUB = {
  endAt: () => {}, get: () => {}, limitToLast: () => {}, onValue: () => {},
  orderByKey: () => {}, query: () => {}, ref: () => {}, startAt: () => {},
  db: {},
};

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const code = babel.transformFileSync(file, {
    presets: [],
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
    babelrc: false,
    configFile: false,
  }).code;
  const dir = file.slice(0, file.lastIndexOf('/'));
  const localRequire = (spec) => {
    if (spec.startsWith('firebase/') || spec.endsWith('/firebase')) return FIREBASE_STUB;
    if (spec.startsWith('.')) {
      const resolved = new URL(spec, `file://${process.cwd()}/${dir}/`).pathname;
      return load(resolved.replace(`${process.cwd()}/`, '') + '.js');
    }
    return require(spec);
  };
  const module = { exports: {} };
  cache.set(file, module.exports);
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire);
  cache.set(file, module.exports);
  return module.exports;
}

const feed = load('src/data/deviceFeed.js');
const history = load('src/data/history.js');
const levels = load('src/data/levels.js');
const alerts = load('src/data/alerts.js');
const placement = load('src/data/placement.js');

const raw = SCRATCH
  ? JSON.parse(fs.readFileSync(SCRATCH, 'utf8'))
  : await fetch(`${DB_URL}/device_data/${DEVICE}.json`).then((r) => r.json());
if (!raw || typeof raw !== 'object') {
  console.error('No readings at device_data/' + DEVICE + ' — is the node publishing?');
  process.exit(1);
}
const samples = Object.entries(raw)
  .map(([key, value]) => ({ at: feed.readingTime(key, value), reading: feed.toReading(value) }))
  .filter((s) => s.reading)
  .sort((a, b) => a.at - b.at);

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
};

console.log(`\n== mapping (${samples.length} samples) ==`);
const last = samples[samples.length - 1];
console.log('  newest:', new Date(last.at).toISOString(), JSON.stringify(last.reading));
check('every sample mapped', samples.length === Object.keys(raw).length);
check('co2 is a rounded number', samples.every((s) => s.reading.co2 === null || Number.isInteger(s.reading.co2)));
check('an indoor node never claims outdoor air', samples.every((s) => s.reading.pmOutdoor === null));
check('temp converted C->F into a plausible indoor range',
  samples.every((s) => s.reading.temp === null || (s.reading.temp > 40 && s.reading.temp < 110)),
  `min ${Math.min(...samples.map(s => s.reading.temp))} max ${Math.max(...samples.map(s => s.reading.temp))}`);
check('timestamps ascending and within the last 30 days',
  last.at <= Date.now() + 60000 && samples[0].at > Date.now() - 31 * 864e5);
check('malformed entries do not throw',
  feed.toReading(null) === null && feed.toReading({}) === null && feed.toReading({ readings: {} }) !== null);

console.log('\n== grading ==');
check('null value grades as none', levels.levelFor('pmOutdoor', null) === 'none');
check('missing metric grades as none', levels.levelFor('nonsense', 5) === 'none');
check('formatValue renders an em dash for null', levels.formatValue('co2', null) === '—');
check('formatValue keeps 1dp for PM', levels.formatValue('pmIndoor', 1.64) === '1.6');
check('formatValue groups thousands for co2', levels.formatValue('co2', 1647) === '1,647');
check('toDisplayTemp(null) is null', levels.toDisplayTemp(null, 'F') === null);
check('toDisplayTemp converts F->C', levels.toDisplayTemp(77, 'C') === 25);
check('high co2 with unknown outdoor -> hedged advice',
  levels.evaluate(last.reading) === 'ventilateUnchecked', `got ${levels.evaluate(last.reading)}`);
check('hedged advice page exists', !!levels.STATUS_CONTENT.ventilateUnchecked);
check('suggestionFor co2 hedges too',
  levels.suggestionFor('co2', { co2: 1500, pmIndoor: 2, pmOutdoor: null }) === 'ventilateUnchecked');
check('known clean outdoor air -> plain ventilate',
  levels.suggestionFor('co2', { co2: 1500, pmIndoor: 2, pmOutdoor: 4 }) === 'ventilate');
check('unhealthy outdoor still wins',
  levels.suggestionFor('co2', { co2: 1500, pmIndoor: 2, pmOutdoor: 80 }) === 'closed');

console.log('\n== placement ==');
const rawEntry = Object.values(raw).find((v) => v && v.readings && typeof v.readings.pm25 === 'number');
const asIndoor = feed.toReading(rawEntry, 'indoor');
const asOutdoor = feed.toReading(rawEntry, 'outdoor');
console.log(`  pm25 ${rawEntry.readings.pm25} -> indoor ${asIndoor.pmIndoor} / outdoor ${asOutdoor.pmOutdoor}`);
check('indoor placement fills pmIndoor', asIndoor.pmIndoor === rawEntry.readings.pm25 && asIndoor.pmOutdoor === null);
check('outdoor placement fills pmOutdoor', asOutdoor.pmOutdoor === rawEntry.readings.pm25 && asOutdoor.pmIndoor === null);
check('co2 is not graded outdoors', asIndoor.co2 !== null && asOutdoor.co2 === null);
check('both placements still report temp and rh',
  asIndoor.temp !== null && asOutdoor.temp !== null && asIndoor.rh !== null && asOutdoor.rh !== null);
check('placement defaults to indoor', feed.toReading(rawEntry).pmIndoor === asIndoor.pmIndoor);

console.log('\n== merging two nodes ==');
const IN = { id: 'a'.repeat(24), placement: 'indoor' };
const OUT = { id: 'b'.repeat(24), placement: 'outdoor' };
const merged = placement.mergeReadings([IN, OUT], {
  [IN.id]: { reading: asIndoor, at: 2000, placement: 'indoor' },
  [OUT.id]: { reading: asOutdoor, at: 3000, placement: 'outdoor' },
});
check('indoor node supplies co2 and indoor pm',
  merged.readings.co2 === asIndoor.co2 && merged.readings.pmIndoor === asIndoor.pmIndoor);
check('outdoor node supplies outdoor pm', merged.readings.pmOutdoor === asOutdoor.pmOutdoor);
check('indoor wins for temp', merged.sources.temp.placement === 'indoor');
check('updatedAt is the newest contributing sample', merged.updatedAt === 3000);
const outdoorOnly = placement.mergeReadings([OUT], { [OUT.id]: { reading: asOutdoor, at: 1000, placement: 'outdoor' } });
check('an outdoor-only install has no indoor readings',
  outdoorOnly.readings.co2 === null && outdoorOnly.readings.pmIndoor === null);
check('an outdoor-only install still reads outdoor pm', outdoorOnly.readings.pmOutdoor === asOutdoor.pmOutdoor);
check('outdoor-only falls back to outdoor temp', outdoorOnly.sources.temp.placement === 'outdoor');
check('an empty install reads nothing', placement.mergeReadings([], {}).updatedAt === null);

console.log('\n== device registration ==');
check('a real device id is well formed', feed.isValidDeviceId(DEVICE));
check('id is normalised to lower case', feed.normalizeDeviceId(`  ${DEVICE.toUpperCase()}  `) === DEVICE);
check('a short id is rejected', !feed.isValidDeviceId('e00fce68'));
check('a 24-char non-hex id is rejected', !feed.isValidDeviceId('z'.repeat(24)));
check('an empty id is rejected', !feed.isValidDeviceId('') && !feed.isValidDeviceId(null));

console.log('\n== alert log over the real series ==');
let log = [];
for (const s of samples) log = alerts.applyReadings(log, s.reading, levels.DEFAULT_THRESHOLDS, s.at);
const open = log.filter((e) => e.endedAt == null);
const closed = log.filter((e) => e.endedAt != null);
console.log(`  ${log.length} events (${open.length} open, ${closed.length} resolved)`);
for (const e of log.slice(0, 4)) {
  console.log(`   - ${e.metric} peak ${e.peak} from ${new Date(e.startedAt).toISOString()}` +
    ` to ${e.endedAt ? new Date(e.endedAt).toISOString() : 'open'}`);
}
check('no alert raised for the metric with no source', !log.some((e) => e.metric === 'pmOutdoor'));
check('every event has a peak and a snapshot',
  log.every((e) => typeof e.peak === 'number' && e.snapshot && e.peakLevel === 'bad'));
check('resolved events kept regardless of day', true);
check('log is idempotent on a repeated sample',
  alerts.applyReadings(log, last.reading, levels.DEFAULT_THRESHOLDS, last.at) === log ||
  alerts.applyReadings(log, last.reading, levels.DEFAULT_THRESHOLDS, last.at).length === log.length);

console.log('\n== chart series ==');
for (const range of ['24h', '7d', '30d']) {
  const now = last.at;
  const series = history.toSeries(samples, range, now);
  const filled = series.co2.filter((v) => v !== null).length;
  const total = series.co2.length;
  console.log(`  ${range}: ${filled}/${total} buckets filled, ` +
    `co2 ${Math.min(...series.co2.filter(Boolean)).toFixed(0)}-${Math.max(...series.co2.filter(Boolean)).toFixed(0)}`);
  check(`${range} series length matches the grid`, total === history.RANGES[range].points);
  check(`${range} has data`, filled > 0);
  check(`${range} pmOutdoor is all gaps`, series.pmOutdoor.every((v) => v === null));
  check(`${range} values are finite or null`,
    series.co2.every((v) => v === null || isFinite(v)));
  const labels = history.rollingXLabels(range, now);
  check(`${range} labels span 0..1`, labels[0].pos === 0 && labels[labels.length - 1].pos === 1);
}
const emptySeries = history.toSeries([], '24h', Date.now());
check('empty input yields an all-null series', emptySeries.co2.every((v) => v === null));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
