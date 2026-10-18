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

Configuration lives in [src/firebase.js](src/firebase.js). The device id is
*not* there: the app reads whichever node the user registered on first launch
(see [Device registration](#device-registration)). Only two Firebase products
are used:

- **`firebase/app`** — initialises the project.
- **`firebase/database`** — the Realtime Database, read in three ways:
  [`subscribeLatestReading()`](src/data/deviceFeed.js) keeps an `onValue`
  listener on the newest sample, so the Home tab updates the moment the node
  publishes; `fetchRange()` does a one-shot read of a time window for the
  Analytics charts; and `lookupDevice()` checks a single id during registration.
  All three take the device id as their first argument — nothing defaults to a
  particular node.

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

Which slot a sample fills depends on the node's placement (see
[Devices and placement](#devices-and-placement)):

| App | Database | Indoor node | Outdoor node |
|---|---|---|---|
| `co2` | `readings.co2` | ppm, rounded | `null` |
| `pmIndoor` | `readings.pm25` | µg/m³ | `null` |
| `pmOutdoor` | `readings.pm25` | `null` | µg/m³ |
| `temp` | `readings.tempC` | converted to °F | converted to °F |
| `rh` | `readings.rh` | % | % |

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

## Devices and placement

The app shows nothing until at least one node is registered. There is no demo
or simulated mode: every number on screen came from hardware.

Each registered node carries a **placement**, which decides what it
contributes — the same SEN66 means different things depending on where it is:

| Placement | Supplies | Why not the rest |
|---|---|---|
| `indoor` | CO₂, indoor PM2.5, temperature, humidity | — |
| `outdoor` | outdoor PM2.5, temperature, humidity | outdoor CO₂ sits near 420 ppm whatever the air is doing, so grading it would be noise dressed as a reading |

Readings from every node are folded into one set by
[`mergeReadings()`](src/data/placement.js): each placement fills only its own
slots, and where both could answer (temperature, humidity) the indoor node
wins, because that is the air you are sitting in. A slot no node supplies stays
null and renders as "No data". `mergeReadings` is plain data logic, kept out of
`SensorContext` so `npm run verify` can exercise it.

With one indoor node, outdoor PM2.5 is unknown and ventilation advice stays
hedged (`ventilateUnchecked`). Register an outdoor node too and the full
indoor-versus-outdoor logic applies.

### Registering

On first launch the user passes through `StartScreen`, then
[`RegisterDeviceScreen`](src/screens/RegisterDeviceScreen.js), which asks for
the Boron's 24-character Particle device id and its placement. Before saving it
the screen calls `lookupDevice()` and refuses an id that has never published,
so a typo is caught at registration rather than becoming an empty Home tab.
Registering an id that is already registered moves it to the new placement
instead of listing the same node twice.

Nodes live in [`SettingsContext`](src/state/SettingsContext.js) as
`settings.devices` — `[{ id, placement }]` in `AsyncStorage`. An install from
before placement existed stored a single `deviceId` string; it is read forward
as one indoor node. `App.js` gates the tabs on there being at least one node.

### Managing them

The gear at the top right of the **My Air** tab opens
[`SettingsScreen`](src/screens/SettingsScreen.js), which lists every registered
node and lets you switch its placement between indoor and outdoor, unregister
it, or register another. Unregistering the last node returns the app to the
registration gate.

Alert history is one log for the install (`airguard.alerts.v5`) rather than one
per node: readings are merged from several devices, so an alert belongs to the
home, and keying it per device would split one alert's history across whichever
nodes happened to see it.

## Known gaps

- **Outdoor PM2.5 needs a second node.** With only an indoor node registered, a
  high CO₂ reading opens the hedged "Ventilate If You Can" page rather than
  claiming the air outside is clean. Register a node with `outdoor` placement
  and the full comparison applies; there is still no public-API fallback for
  installs with one node.
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
