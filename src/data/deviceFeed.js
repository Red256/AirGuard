import { endAt, get, limitToLast, onValue, orderByKey, query, ref, startAt } from 'firebase/database';
import { db, DEVICE_ID } from '../firebase';

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

const numberOr = (value, fallback = null) => (typeof value === 'number' && isFinite(value) ? value : fallback);

const cToF = (c) => (c * 9) / 5 + 32;

// Translates one stored sample into the shape the app grades and renders.
// `pmOutdoor` is null on purpose: the SEN66 is an indoor node and nothing in
// the feed measures outdoor air, so the app shows it as unavailable instead of
// inventing a number. Give it a source (a second node, or an outdoor AQ API)
// and this is the single line that needs to change.
export function toReading(entry) {
  const r = entry && entry.readings;
  if (!r) return null;
  const tempC = numberOr(r.tempC);
  const co2 = numberOr(r.co2);
  return {
    co2: co2 == null ? null : Math.round(co2),
    pmIndoor: numberOr(r.pm25),
    pmOutdoor: null,
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

// Subscribes to the newest sample. Calls back with
// { reading, at, error } and returns the unsubscribe function.
export function subscribeLatestReading(onUpdate, deviceId = DEVICE_ID) {
  const latest = query(ref(db, devicePath(deviceId)), orderByKey(), limitToLast(1));
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
        reading: toReading(newest.value),
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
export async function fetchRange(fromMs, toMs = Date.now(), deviceId = DEVICE_ID) {
  const window = query(
    ref(db, devicePath(deviceId)),
    orderByKey(),
    startAt(String(Math.floor(fromMs / 1000))),
    endAt(String(Math.floor(toMs / 1000)))
  );
  const snapshot = await get(window);
  const out = [];
  snapshot.forEach((child) => {
    const value = child.val();
    const reading = toReading(value);
    if (reading) out.push({ at: readingTime(child.key, value), reading });
  });
  out.sort((a, b) => a.at - b.at);
  return out;
}
