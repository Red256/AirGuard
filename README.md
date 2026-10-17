# AirGuard

Indoor air quality monitor: a Sensirion SEN66 on a Particle Boron measures the
air, a Particle webhook writes each sample into Firebase, and an Expo app reads
it back, grades it and says what to do about it.

```
SEN66 ──I2C──► Boron ──Particle.publish("sen66")──► Particle Cloud
                                                         │ webhook
                                                         ▼
                                   Firebase Realtime Database
                                   device_data/<deviceId>/<epoch>
                                                         │
                                                         ▼
                                        Expo app (this repo)
```

| Path | What it is |
|---|---|
| `App.js`, `src/` | the Expo app |
| `sen66-aqi-node/` | the Boron firmware — see its own [README](sen66-aqi-node/README.md) |
| `scripts/verify-feed.mjs` | smoke test for the data path, against the live database |

## Running the app

```bash
npm install
npm start          # then press w for web, or scan the QR code
npm run verify     # check the database feed and the grading rules
```

## Firebase

Configuration lives in [src/firebase.js](src/firebase.js), with the device id the
app reads. Only two Firebase products are used:

- **`firebase/app`** — initialises the project.
- **`firebase/database`** — the Realtime Database, read in two ways:
  [`subscribeLatestReading()`](src/data/deviceFeed.js) keeps an `onValue`
  listener on the newest sample, so the Home tab updates the moment the node
  publishes, and `fetchRange()` does a one-shot read of a time window for the
  Analytics charts.

Firebase Analytics is deliberately *not* initialised — `getAnalytics()` needs a
browser `document` and throws under React Native.

The config values in `src/firebase.js` are committed on purpose. A Firebase web
config is not a credential: it identifies the project, and access is decided by
the database rules.

### Stored shape

The webhook writes one child per sample, keyed by the device's epoch-second
timestamp (which is why the firmware publishes `ts` as an integer rather than an
ISO string — RTDB keys cannot contain `.`):

```json
"device_data/e00fce6893f468b723fe10b0/1792115244": {
  "deviceId": "e00fce6893f468b723fe10b0",
  "receivedAt": 1792115245123,
  "readings": {
    "ts": 1792115244, "sn": "45FBD31303BF5664",
    "co2": 1227, "pm1": 0.9, "pm25": 1.2, "pm4": 1.4, "pm10": 1.4,
    "tempC": 25.64, "rh": 39.56, "voc": 13, "nox": 1,
    "aqi": 12, "aqiRaw": 7, "aqiCat": "Good"
  }
}
```

A field is **absent**, not zero, when the sensor reports that channel as
invalid — the firmware omits it (see `publishMeasurement`). The app maps every
absent field to `null` and grades it as `No data`, which is also how outdoor
PM2.5 is shown, because nothing measures it yet.

### Mapping to the app's model

| App | Database | Note |
|---|---|---|
| `co2` | `readings.co2` | ppm, rounded |
| `pmIndoor` | `readings.pm25` | µg/m³ |
| `pmOutdoor` | — | no source; always `No data` |
| `temp` | `readings.tempC` | converted to °F |
| `rh` | `readings.rh` | % |

`pm1`, `pm4`, `pm10`, `voc`, `nox`, `aqi` and `aqiCat` are mapped through but not
yet graded or charted.

### Database rules

Anonymous clients can read this database, which is what the app relies on. Check
in the Firebase console that writes are *not* also open — otherwise anyone who
sees these config values can overwrite or delete your history. Reads open, writes
closed to everything except the webhook's secret looks like:

```json
{
  "rules": {
    "device_data": {
      ".read": true,
      ".write": false
    }
  }
}
```

The webhook then needs a database secret or a service account to write, set in
the Particle integration rather than in the rules.

## Known gaps

- **Outdoor PM2.5 has no sensor.** Until one exists, a high CO₂ reading opens the
  hedged "Ventilate If You Can" page rather than claiming the air outside is
  clean. Giving it a source is one line in `toReading()`.
- **Thresholds differ between the app and the firmware.** The app's PM2.5 "Good"
  ceiling is 12 µg/m³ (`src/data/levels.js`); the firmware's LED uses the EPA's
  2024 table, where Good ends at 9.0. The same air can be green on the strip and
  orange in the app.
- **The node publishes intermittently.** Over the last week the database holds
  roughly 12 samples a day, not the 288 a 5-minute interval implies, so charts
  show gaps. Gaps are drawn as gaps rather than interpolated.
- **Alerts are logged on the device, not pushed.** The log lives in
  `AsyncStorage`, so it only grows while the app is open, and there are no push
  notifications.
