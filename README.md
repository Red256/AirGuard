# AirGuard

AirGuard is an integrated mobile app and sensor system that monitors indoor CO₂, indoor PM2.5, and outdoor PM2.5 levels, providing clear, actionable recommendations on when to ventilate, keep windows closed, or investigate indoor pollution sources. The system features a custom-built air quality monitor equipped with a Sensirion SEN66 air sensor, a Particle Boron microcontroller, and an LED strip for visual feedback. The companion mobile app is developed using Expo and React Native.

## Demo video

▶️ Watch the AirGuard demo on YouTube: [youtu.be/qUMVcUxJ-n0](https://www.youtube.com/watch?v=qUMVcUxJ-n0)

## Why it matters

Opening a window fixes stuffy, high-CO₂ air, but it can pull in wildfire smoke or traffic pollution if the air outside is worse. AirGuard compares what is happening inside and outside so you do not have to guess.

## Features

- **Live readings** for indoor CO₂, indoor PM2.5 and outdoor PM2.5, each rated Good, Moderate or Unhealthy.
- **Plain-language suggestions** that tell you what to do:
  - Outdoor PM2.5 Unhealthy: keep windows closed.
  - Indoor PM2.5 Unhealthy: ventilate and check indoor sources (cooking, candles, etc.).
  - CO₂ Unhealthy and outdoor air is fine: open a window.
- **Alerts** when a reading becomes Unhealthy.
- **Trends** with charts of past readings.
- **FAQ / Resources** explaining what CO₂ and PM2.5 are and why they matter.
- **Adjustable settings** such as update interval and thresholds.

### Default thresholds

| Reading | Good | Moderate | Unhealthy |
|---|---|---|---|
| Indoor CO₂ | ≤ 800 ppm | ≤ 1200 ppm | > 1200 ppm |
| Indoor PM2.5 | ≤ 12 µg/m³ | ≤ 35 µg/m³ | > 35 µg/m³ |
| Outdoor PM2.5 | ≤ 12 µg/m³ | ≤ 35 µg/m³ | > 35 µg/m³ |

## Hardware

The `sen66-aqi-node/` folder contains firmware for a **Sensirion SEN66** on a **Particle Boron**. It reads PM1.0/2.5/4.0/10, temperature, humidity, VOC index, NOx index and CO₂ over I²C, publishes JSON to the Particle Cloud, and drives a 25-LED WS2812B strip that shows the current US EPA Air Quality Index colour (green to maroon).

See [`sen66-aqi-node/README.md`](sen66-aqi-node/README.md) for wiring, build and flash instructions, the cloud API, and how the AQI is calculated.

## Built with

- [Expo](https://expo.dev/) / [React Native](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [react-native-svg](https://github.com/software-mansion/react-native-svg) for charts
- Particle Device OS, Sensirion SEN66, WS2812B (hardware)
