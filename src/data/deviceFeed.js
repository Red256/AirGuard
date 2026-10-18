import { endAt, get, limitToLast, onValue, orderByKey, query, ref, startAt } from 'firebase/database';
import { db } from '../firebase';

// Live readings from the SEN66 node, as published by the Boron through the
// Particle webhook into the Realtime Database:
//
//   device_data/<deviceId>/<epoch seconds> = {
//     deviceId, receivedAt,
//     readings: { ts, sn, co2, pm1, pm25, pm4, pm10, tempC, rh, voc, nox,
//                 aqi, aqiRaw, aqiCat }
//   }
//
// The firmware omits a field entirely when the sensor reports that channel as
// invalid (see publishMeasurement in sen66_aqi.cpp), so every value here is
// optional and maps to null rather than to 0.

const devicePath = (deviceId) => `device_data/${deviceId}`;

// A Particle device id is 24 hex characters. Checking the shape before we query
// keeps a typo from becoming a database path, and lets the registration screen
// say what is wrong without a round trip.
const DEVICE_ID_RE = /^[0-9a-f]{24}$/;

export const normalizeDeviceId = (input) => String(input || '').trim().toLowerCase();

export const isValidDeviceId = (input) => DEVICE_ID_RE.test(normalizeDeviceId(input));

const numberOr = (value, fallback = null) => (typeof value === 'number' && isFinite(value) ? value : fallback);

const cToF = (c) => (c * 9) / 5 + 32;

// Translates one stored sample into the shape the app grades and renders.
//
// `placement` decides which slots the sample fills, because the same SEN66
// hardware means different things depending on where it is:
//   indoor  - CO₂ and indoor PM2.5 (outdoor PM2.5 stays null)
//   outdoor - outdoor PM2.5 only. CO₂ outdoors sits near 420 ppm whatever the
//             air is doing, so grading it would be noise dressed as a reading.
// A slot nothing measures stays null rather than 0, so the app can say
// "No data" instead of inventing a number.
export function toReading(entry, placement = 'indoor') {
  const r = entry && entry.readings;
  if (!r) return null;
  const outdoor = placement === 'outdoor';
  const tempC = numberOr(r.tempC);
  const co2 = numberOr(r.co2);
  const pm25 = numberOr(r.pm25);
  return {
    co2: outdoor || co2 == null ? null : Math.round(co2),
    pmIndoor: outdoor ? null : pm25,
    pmOutdoor: outdoor ? pm25 : null,
    temp: tempC == null ? null : cToF(tempC),
    rh: numberOr(r.rh),
    // Channels the node reports that the main screens do not grade yet.
    pm1: numberOr(r.pm1),
    pm4: numberOr(r.pm4),
    pm10: numberOr(r.pm10),
    voc: numberOr(r.voc),
    nox: numberOr(r.nox),
    aqi: numberOr(r.aqi),
    aqiCat: typeof r.aqiCat === 'string' ? r.aqiCat : null,
    serial: typeof r.sn === 'string' ? r.sn : null,
  };
}

// When the sample was taken on the device, in ms. Falls back to the time the
// webhook wrote it, then to the node key, so "updated 4 minutes ago" always
// refers to the reading rather than to when the app opened.
export function readingTime(key, entry) {
  const ts = entry && entry.readings && numberOr(entry.readings.ts);
  if (ts) return ts * 1000;
  const received = entry && numberOr(entry.receivedAt);
  if (received) return received;
  const fromKey = Number(key);
  return isFinite(fromKey) ? fromKey * 1000 : Date.now();
}

// Looks a device up during registration. Resolves to
// { found, lastAt, reading } — found is false when the id has never published,
// which is how the registration screen tells "wrong id" from "right id, but
// the node has not reported yet". Rejects only if the database is unreachable.
export async function lookupDevice(deviceId) {
  const id = normalizeDeviceId(deviceId);
  const latest = query(ref(db, devicePath(id)), orderByKey(), limitToLast(1));
  const snapshot = await get(latest);
  let newest = null;
  snapshot.forEach((child) => {
    newest = { key: child.key, value: child.val() };
  });
  if (!newest) return { found: false, lastAt: null, reading: null };
  return {
    found: true,
    lastAt: readingTime(newest.key, newest.value),
    reading: toReading(newest.value),
  };
}

// Subscribes to one node's newest sample. `device` is a registered
// { id, placement }. Calls back with { reading, at, error } and returns the
// unsubscribe function.
export function subscribeLatestReading(device, onUpdate) {
  const latest = query(ref(db, devicePath(device.id)), orderByKey(), limitToLast(1));
  return onValue(
    latest,
    (snapshot) => {
      let newest = null;
      // limitToLast(1) still arrives as a one-child collection.
      snapshot.forEach((child) => {
        newest = { key: child.key, value: child.val() };
      });
      if (!newest) {
        onUpdate({ reading: null, at: null, error: null });
        return;
      }
      onUpdate({
        reading: toReading(newest.value, device.placement),
        at: readingTime(newest.key, newest.value),
        error: null,
      });
    },
    (error) => onUpdate({ reading: null, at: null, error })
  );
}

// One-shot read of every sample in [fromMs, toMs], oldest first.
// Node keys are epoch seconds as strings; orderByKey() with string bounds is a
// lexicographic range, which is also chronological while the keys stay the
// same length (10 digits until 2286).
export async function fetchRange(device, fromMs, toMs = Date.now()) {
  const window = query(
    ref(db, devicePath(device.id)),
    orderByKey(),
    startAt(String(Math.floor(fromMs / 1000))),
    endAt(String(Math.floor(toMs / 1000)))
  );
  const snapshot = await get(window);
  const out = [];
  snapshot.forEach((child) => {
    const value = child.val();
    const reading = toReading(value, device.placement);
    if (reading) out.push({ at: readingTime(child.key, value), reading });
  });
  out.sort((a, b) => a.at - b.at);
  return out;
}
