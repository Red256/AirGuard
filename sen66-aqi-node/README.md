# SEN66 AQI node — Particle Boron

Firmware for a Sensirion SEN66 on a Particle Boron. Reads PM1.0/2.5/4.0/10,
temperature, humidity, VOC index, NOx index and CO2 over I2C, prints them to
USB serial every second, publishes JSON to the Particle Cloud, and drives a
25-LED WS2812B strip showing the US EPA Air Quality Index category colour.

This is the source for the latest build (`aqi.bin`).

## Files

```
project.properties       build config + library dependency
src/sen66_aqi.cpp        application: sampling, AQI maths, LED strip, cloud
lib/SEN66/src/SEN66.h    driver API
lib/SEN66/src/SEN66.cpp  driver: I2C framing, CRC-8, datasheet scaling
note_3.txt               derivation of the AQI breakpoints and colours
```

## Dependencies

- **Particle Device OS** 1.5+ on a Gen 3 device (Boron, B-SoM, Argon, Photon 2).
  Built and tested on a Boron.
- **neopixel 1.0.4** — a Particle cloud library, declared in
  `project.properties`. `particle compile` fetches it; nothing to install.
- `lib/SEN66` is a local Particle library, picked up automatically from
  `lib/<Name>/src/`. It is self-contained — no Sensirion Core needed.

## Build and flash

```bash
particle compile boron . --saveTo firmware.bin
particle flash <device-name> firmware.bin
```

Or use the Workbench "Compile application (local)" task.

## Wiring

| SEN66 cable | Boron |
|---|---|
| 1 VDD (red) | `3V3` |
| 2 GND (black) | `GND` |
| 3 SDA (green) | `D0 / SDA` |
| 4 SCL (yellow) | `D1 / SCL` |
| 5, 6 | leave unconnected |

SEN66 runs on **3.3 V ±10 %** — not 5 V. It draws ~90 mA average, ~250 mA while
the fan spins up. D0/D1 already have 10 kΩ pull-ups on the Boron. I2C address is
`0x6B`, not configurable.

The WS2812B strip takes DIN on `D2` through a 330 Ω series resistor, and **its
own 5 V supply** — not the Boron's 3V3 — with grounds tied common.

## AQI colours

| AQI | Colour | Category | PM2.5 (µg/m³) |
|---|---|---|---|
| 0–50 | green | Good | 0.0–9.0 |
| 51–100 | yellow | Moderate | 9.1–35.4 |
| 101–150 | orange | Unhealthy for Sensitive Groups | 35.5–55.4 |
| 151–200 | red | Unhealthy | 55.5–125.4 |
| 201–300 | purple | Very Unhealthy | 125.5–225.4 |
| 301–500 | maroon | Hazardous | 225.5–325.4 |
| — | dim white | no PM reading yet | |

Colours are AirNow's official category hex values; PM2.5 breakpoints are the
EPA table effective 2024-05-06. Overall AQI is the higher of the PM2.5 and PM10
sub-indices. Readings are smoothed with a ~5 min EMA by default, because EPA
breakpoints are defined on 24-hour averages. See `note_3.txt`.

## Cloud API

| Function | Argument | Effect |
|---|---|---|
| `fanClean` | — | 10 s fan-cleaning cycle (run weekly-ish) |
| `reset` | — | soft-reset the sensor, restart measurement |
| `altitude` | metres, 0–3000 | CO2 altitude compensation |
| `pressure` | hPa, 700–1200 | CO2 pressure compensation, live |
| `ledBright` | percent, 0–100 | strip brightness (not persisted) |
| `aqiSmooth` | `1` / `0` | EMA-smoothed AQI (default) or instantaneous |

Variables: `serial`, `aqi`, `aqiRaw`, `aqiCat`.

```bash
particle call <device-name> ledBright 25
particle get <device-name> aqiCat
```
