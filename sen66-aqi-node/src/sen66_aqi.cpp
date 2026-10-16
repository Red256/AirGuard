/*
 * SEN66 air-quality node on a Particle Boron - US AQI indicator variant
 *
 * Copy of sen66_boron.cpp. Everything about the sensor, the serial log, the
 * cloud functions and the Particle publish is unchanged; the only difference
 * is the LED strip, which now shows the US EPA Air Quality Index colour
 * derived from the particulate readings instead of a CO2 band.
 *
 * Wiring (SEN66 cable -> Boron):
 *   VDD (pin 1, red)    -> 3V3        (3.3 V +/-10 %, ~90 mA avg / 250 mA peak)
 *   GND (pin 2, black)  -> GND
 *   SDA (pin 3, green)  -> D0 / SDA
 *   SCL (pin 4, yellow) -> D1 / SCL
 *   pins 5 & 6          -> leave unconnected
 * The Boron has 10k pull-ups on D0/D1, so no external resistors are needed.
 *
 * Wiring (WS2812B strip, 5 wires -> Boron):
 *   group 1 green (DIN)   -> D2 through a 330 ohm series resistor
 *   group 1 red  (+5 V)   -> external 5 V supply, through a 1N4001
 *   group 1 white (GND)   -> supply ground, tied common with Boron GND
 *   group 2 red/white     -> same two rails in parallel, or left unconnected
 * Group 2 is an auxiliary power tap, not a second channel. Never put the red
 * wire on the Boron.
 *
 * A 25-LED WS2812B strip on D2 shows the US AQI category as a colour:
 *
 *   AQI        Colour   Category                        PM2.5 (ug/m3)
 *   ---------  -------  ------------------------------  -------------
 *     0 -  50  green    Good                              0.0 -   9.0
 *    51 - 100  yellow   Moderate                          9.1 -  35.4
 *   101 - 150  orange   Unhealthy for Sensitive Groups   35.5 -  55.4
 *   151 - 200  red      Unhealthy                        55.5 - 125.4
 *   201 - 300  purple   Very Unhealthy                  125.5 - 225.4
 *   301 - 500  maroon   Hazardous                       225.5 - 325.4
 *   no reading dim white  SEN66 has not reported PM yet
 *
 * Colours are AirNow's official category hex values. PM2.5 breakpoints are the
 * EPA's post-2024 table (effective 2024-05-06, which moved the Good ceiling
 * from 12.0 to 9.0 ug/m3). The overall AQI is the higher of the PM2.5 and PM10
 * sub-indices, which is how EPA defines it. See note_3.txt for the full
 * derivation and AQI_PM25[] / AQI_PM10[] / AQI_CATEGORIES[] below for the
 * authoritative tables.
 *
 * Power: 25 WS2812Bs at brightness 26/255 draw ~150 mA at full white, but no
 * AQI colour is full white - yellow is the worst case at ~100 mA and green
 * costs ~45 mA. Run the strip from its own 5 V supply, not the Boron's 3V3.
 *
 * Cloud functions (callable from the console / API):
 *   "fanClean"  - run the 10 s fan cleaning cycle
 *   "reset"     - soft-reset the sensor and restart measurement
 *   "altitude"  - set sensor altitude in metres for CO2 compensation
 *   "pressure"  - set ambient pressure in hPa for CO2 compensation
 *   "ledBright" - strip brightness in percent, 0-100 (not persisted)
 *   "aqiSmooth" - 1 = EMA-smoothed AQI (default), 0 = instantaneous
 *
 * Cloud variables: serial, aqi, aqiRaw, aqiCat
 */

#include "Particle.h"
#include "SEN66.h"
#include "neopixel.h"

#include <algorithm>
#include <cmath>
#include <new>

SYSTEM_MODE(AUTOMATIC);
SYSTEM_THREAD(ENABLED);

// --- configuration ------------------------------------------------------
const uint32_t SAMPLE_INTERVAL = 1000;         // sensor updates at 1 Hz
const uint32_t PUBLISH_INTERVAL = 5 * 60 * 1000;  // 5 min; mind your data plan
const uint32_t WARMUP_MS = 10000;              // skip the first samples
const size_t WIRE_BUFFER_SIZE = 64;            // >= 48 for serial-number reads

// --- AQI indicator strip ------------------------------------------------
const uint16_t LED_COUNT = 25;
const int LED_PIN = D2;
const uint8_t LED_TYPE = WS2812B;
const uint8_t LED_BRIGHTNESS = 26;             // 0-255; 26/255 = 10.2 %
                                               // 25 LEDs at full white here
                                               // would pull ~150 mA, but the
                                               // AQI palette peaks near 100 mA

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, LED_TYPE);

// EPA AQI breakpoints are defined against a 24-HOUR average concentration,
// while the SEN66 reports a near-instantaneous value every second. Feeding a
// 1 Hz reading straight into a 24-hour table makes the colour jump whenever
// someone lights a candle or walks past. An exponential moving average with a
// ~5 minute time constant is the cheap fix; EPA's own answer for sub-daily
// reporting is NowCast, described in note_3.txt.
const bool  AQI_SMOOTHING_DEFAULT = true;
const float AQI_EMA_TAU_S = 300.0f;            // seconds; ~5 min

// --- AQI tables ---------------------------------------------------------
//
// Sub-index for one pollutant, by linear interpolation inside the band that
// contains the concentration:
//
//   I = (iHi - iLo) / (cHi - cLo) * (C - cLo) + iLo
//
// PM2.5 truncates to 1 decimal place and PM10 to a whole number before the
// lookup - that truncation is what closes the apparent gaps between bands
// (e.g. PM10 54.0 -> 55.0, PM2.5 9.0 -> 9.1).
struct AqiBreakpoint {
    float cLo, cHi;     // concentration, ug/m3
    int   iLo, iHi;     // AQI
};

// PM2.5, 24-hour, EPA table effective 2024-05-06.
const AqiBreakpoint AQI_PM25[] = {
    {   0.0f,   9.0f,   0,  50 },
    {   9.1f,  35.4f,  51, 100 },
    {  35.5f,  55.4f, 101, 150 },
    {  55.5f, 125.4f, 151, 200 },
    { 125.5f, 225.4f, 201, 300 },
    { 225.5f, 325.4f, 301, 500 },
};

// PM10, 24-hour. Unchanged by the 2024 revision.
const AqiBreakpoint AQI_PM10[] = {
    {   0.0f,  54.0f,   0,  50 },
    {  55.0f, 154.0f,  51, 100 },
    { 155.0f, 254.0f, 101, 150 },
    { 255.0f, 354.0f, 151, 200 },
    { 355.0f, 424.0f, 201, 300 },
    { 425.0f, 604.0f, 301, 500 },
};

// Category colours are AirNow's published hex values:
//   Good #00E400  Moderate #FFFF00  USG #FF7E00
//   Unhealthy #FF0000  Very Unhealthy #8F3F97  Hazardous #7E0023
// `maxAqi` is inclusive; the last entry is the catch-all.
struct AqiCategory {
    int maxAqi;
    uint8_t r, g, b;
    const char* label;
};

const AqiCategory AQI_CATEGORIES[] = {
    {  50,   0, 228,   0, "Good"                           },  // green
    { 100, 255, 255,   0, "Moderate"                       },  // yellow
    { 150, 255, 126,   0, "Unhealthy for Sensitive Groups" },  // orange
    { 200, 255,   0,   0, "Unhealthy"                      },  // red
    { 300, 143,  63, 151, "Very Unhealthy"                 },  // purple
    { 500, 126,   0,  35, "Hazardous"                      },  // maroon
};

// Shown while the SEN66 has not yet produced a particulate reading.
const AqiCategory AQI_UNKNOWN = { 0, 60, 60, 60, "no reading" };

// Particle Gen3 lets the application size the I2C buffers. 48-byte responses
// (serial number, product name) do not fit the 32-byte default.
hal_i2c_config_t acquireWireBuffer() {
    hal_i2c_config_t config = {
        .size = sizeof(hal_i2c_config_t),
        .version = HAL_I2C_CONFIG_VERSION_1,
        .rx_buffer = new (std::nothrow) uint8_t[WIRE_BUFFER_SIZE],
        .rx_buffer_size = WIRE_BUFFER_SIZE,
        .tx_buffer = new (std::nothrow) uint8_t[WIRE_BUFFER_SIZE],
        .tx_buffer_size = WIRE_BUFFER_SIZE,
    };
    return config;
}

SerialLogHandler logHandler(LOG_LEVEL_INFO);

SEN66 sensor(Wire, SEN66_I2C_ADDRESS);

retained uint32_t bootCount = 0;

static SEN66Measurement latest;
static bool haveMeasurement = false;
static uint32_t lastSample = 0;
static uint32_t lastPublish = 0;
static uint32_t measurementStartedAt = 0;
static char serialNumber[33] = "unknown";

static uint8_t ledBrightness = LED_BRIGHTNESS;
static bool aqiSmoothing = AQI_SMOOTHING_DEFAULT;

// Smoothed PM concentrations feeding the AQI calculation.
static float emaPm25 = NAN;
static float emaPm10 = NAN;

// Published to the cloud.
static int cloudAqi = -1;       // smoothed, -1 until the first PM reading
static int cloudAqiRaw = -1;    // instantaneous
static char cloudAqiCat[40] = "no reading";

// --- AQI maths ----------------------------------------------------------

// Truncate to `decimals` places the way EPA specifies, i.e. toward zero, not
// round-to-nearest. 35.49 must stay in the Moderate band, not jump to USG.
static float truncateTo(float value, int decimals) {
    float scale = powf(10.0f, (float)decimals);
    return truncf(value * scale) / scale;
}

static int subIndex(float concentration, const AqiBreakpoint* table,
                    size_t count, int decimals) {
    if (!(concentration >= 0.0f)) {   // also catches NAN
        return -1;
    }
    float c = truncateTo(concentration, decimals);

    for (size_t i = 0; i < count; i++) {
        const AqiBreakpoint& bp = table[i];
        if (c <= bp.cHi) {
            // Below the first band's cLo can only happen for c < 0, already
            // handled, so clamp into the band and interpolate.
            float lo = std::max(c, bp.cLo);
            float span = bp.cHi - bp.cLo;
            if (span <= 0.0f) {
                return bp.iHi;
            }
            float i_f = (float)(bp.iHi - bp.iLo) / span * (lo - bp.cLo)
                        + (float)bp.iLo;
            return (int)lroundf(i_f);
        }
    }
    // Past the top of the table. EPA stops reporting at 500; "beyond the AQI"
    // extensions exist but are not part of the public index.
    return 500;
}

// Overall AQI is the maximum of the available sub-indices, not an average -
// the index reports the single worst pollutant.
static int overallAqi(float pm25, float pm10, int* whichPm) {
    int i25 = subIndex(pm25, AQI_PM25, arraySize(AQI_PM25), 1);
    int i10 = subIndex(pm10, AQI_PM10, arraySize(AQI_PM10), 0);

    if (i25 < 0 && i10 < 0) {
        if (whichPm) *whichPm = 0;
        return -1;
    }
    if (whichPm) *whichPm = (i25 >= i10) ? 25 : 10;
    return std::max(i25, i10);
}

static const AqiCategory* categoryFor(int aqi) {
    if (aqi < 0) {
        return &AQI_UNKNOWN;
    }
    for (const AqiCategory& candidate : AQI_CATEGORIES) {
        if (aqi <= candidate.maxAqi) {
            return &candidate;
        }
    }
    return &AQI_CATEGORIES[arraySize(AQI_CATEGORIES) - 1];
}

// --- cloud functions ----------------------------------------------------

static int cloudFanClean(String arg) {
    int16_t error = sensor.startFanCleaning();
    Log.info("fan cleaning: %s", SEN66::errorString(error));
    return error;
}

static int cloudReset(String arg) {
    int16_t error = sensor.deviceReset();
    if (error == SEN66_OK) {
        error = sensor.startContinuousMeasurement();
        measurementStartedAt = millis();
        haveMeasurement = false;
    }
    Log.info("reset: %s", SEN66::errorString(error));
    return error;
}

static int cloudSetAltitude(String arg) {
    long metres = arg.toInt();
    if (metres < 0 || metres > 3000) {
        return -100;
    }
    // Altitude may only be written while the sensor is idle.
    int16_t error = sensor.stopMeasurement();
    if (error == SEN66_OK) {
        error = sensor.setSensorAltitude((uint16_t)metres);
    }
    int16_t restart = sensor.startContinuousMeasurement();
    measurementStartedAt = millis();
    haveMeasurement = false;
    Log.info("altitude %ld m: %s", metres, SEN66::errorString(error));
    return error != SEN66_OK ? error : restart;
}

static int cloudSetPressure(String arg) {
    long hPa = arg.toInt();
    if (hPa < 700 || hPa > 1200) {
        return -100;
    }
    int16_t error = sensor.setAmbientPressure((uint16_t)hPa);
    Log.info("ambient pressure %ld hPa: %s", hPa, SEN66::errorString(error));
    return error;
}

// Live brightness, so the strip can be matched to the room without a reflash.
// Not persisted - a reset returns to LED_BRIGHTNESS.
static int cloudSetBrightness(String arg) {
    long pct = arg.toInt();
    if (pct < 0 || pct > 100) {
        return -100;
    }
    ledBrightness = (uint8_t)((pct * 255L) / 100L);
    strip.setBrightness(ledBrightness);
    strip.show();
    Log.info("LED brightness %ld %% (%u/255)", pct, ledBrightness);
    return (int)ledBrightness;
}

static int cloudSetSmoothing(String arg) {
    aqiSmoothing = (arg.toInt() != 0);
    Log.info("AQI smoothing %s", aqiSmoothing ? "on (EMA)" : "off (instant)");
    return aqiSmoothing ? 1 : 0;
}

// --- helpers ------------------------------------------------------------

static void logStatus() {
    SEN66Status status;
    int16_t error = sensor.readDeviceStatus(status);
    if (error != SEN66_OK) {
        Log.warn("device status read failed: %s", SEN66::errorString(error));
        return;
    }
    if (status.anyError() || status.fanSpeedWarning) {
        Log.warn("device status 0x%08lX fan=%d rht=%d gas=%d co2=%d pm=%d "
                 "fanSpeedWarning=%d",
                 (unsigned long)status.raw, status.fanError, status.rhtError,
                 status.gasError, status.co2Error, status.pmError,
                 status.fanSpeedWarning);
    } else {
        Log.info("device status ok (0x%08lX)", (unsigned long)status.raw);
    }
}

// Folds the new sample into the smoothed concentrations. Called once per
// sensor reading, so dt is SAMPLE_INTERVAL.
static void updateEma(const SEN66Measurement& m) {
    if (!m.pmValid) {
        return;
    }
    const float dt = SAMPLE_INTERVAL / 1000.0f;
    const float alpha = dt / (AQI_EMA_TAU_S + dt);

    emaPm25 = std::isnan(emaPm25)
              ? m.pm2p5 : emaPm25 + alpha * (m.pm2p5 - emaPm25);
    emaPm10 = std::isnan(emaPm10)
              ? m.pm10p0 : emaPm10 + alpha * (m.pm10p0 - emaPm10);
}

// Paints the whole strip with the AQI category colour. Redraws only when the
// category changes, so a steady reading does not re-clock 600 bits every
// second.
static void updateIndicator(const SEN66Measurement& m) {
    int whichRaw = 0;
    int whichSmooth = 0;

    cloudAqiRaw = m.pmValid ? overallAqi(m.pm2p5, m.pm10p0, &whichRaw) : -1;
    int smoothed = overallAqi(emaPm25, emaPm10, &whichSmooth);

    int displayed = aqiSmoothing ? smoothed : cloudAqiRaw;
    cloudAqi = displayed;

    const AqiCategory* category = categoryFor(displayed);
    strncpy(cloudAqiCat, category->label, sizeof(cloudAqiCat) - 1);
    cloudAqiCat[sizeof(cloudAqiCat) - 1] = '\0';

    static const AqiCategory* shown = nullptr;
    if (category == shown) {
        return;
    }
    shown = category;

    for (uint16_t i = 0; i < LED_COUNT; i++) {
        strip.setPixelColor(i, category->r, category->g, category->b);
    }
    strip.show();

    if (displayed < 0) {
        Log.info("AQI indicator: %s", category->label);
    } else {
        Log.info("AQI indicator: %d %s (driver PM%d%s)", displayed,
                 category->label,
                 aqiSmoothing ? whichSmooth : whichRaw,
                 aqiSmoothing ? ", smoothed" : "");
    }
}

static void publishMeasurement(const SEN66Measurement& m) {
    // JSONWriter keeps the payload inside Particle's 1024-byte event limit.
    char buffer[622];
    JSONBufferWriter writer(buffer, sizeof(buffer) - 1);
    writer.beginObject();
    if (m.pmValid) {
        writer.name("pm1").value(m.pm1p0, 1);
        writer.name("pm25").value(m.pm2p5, 1);
        writer.name("pm4").value(m.pm4p0, 1);
        writer.name("pm10").value(m.pm10p0, 1);
    }
    if (cloudAqi >= 0) {
        writer.name("aqi").value(cloudAqi);
        writer.name("aqiRaw").value(cloudAqiRaw);
        writer.name("aqiCat").value(cloudAqiCat);
    }
    if (m.rhtValid) {
        writer.name("tempC").value(m.temperature, 2);
        writer.name("rh").value(m.humidity, 2);
    }
    if (m.vocValid) {
        writer.name("voc").value(m.vocIndex, 1);
    }
    if (m.noxValid) {
        writer.name("nox").value(m.noxIndex, 1);
    }
    if (m.co2Valid) {
        writer.name("co2").value((int)m.co2);
    }
    writer.name("sn").value(serialNumber);
    // Epoch seconds: the Firebase webhook uses this as the RTDB node key, so
    // it has to be a key-legal string - an ISO timestamp contains '.', which
    // RTDB rejects.
    writer.name("ts").value((unsigned)Time.now());
    writer.endObject();
    writer.buffer()[std::min(writer.bufferSize(), writer.dataSize())] = '\0';

    bool ok = Particle.publish("sen66", buffer, PRIVATE | WITH_ACK);
    Log.info("publish %s: %s", ok ? "ok" : "FAILED", buffer);
}

static void printMeasurement(const SEN66Measurement& m) {
    Log.info("PM1.0 %.1f  PM2.5 %.1f  PM4.0 %.1f  PM10 %.1f ug/m3",
             m.pm1p0, m.pm2p5, m.pm4p0, m.pm10p0);
    Log.info("T %.2f C  RH %.2f %%  VOC %.1f  NOx %.1f  CO2 %u ppm",
             m.temperature, m.humidity, m.vocIndex, m.noxIndex, m.co2);
    Log.info("AQI %d (%s)  instant %d", cloudAqi, cloudAqiCat, cloudAqiRaw);
}

// --- setup / loop -------------------------------------------------------

void setup() {
    bootCount++;
    Serial.begin(115200);
    waitFor(Serial.isConnected, 3000);
    Log.info("SEN66 Boron AQI node starting (boot #%lu)",
             (unsigned long)bootCount);

    Particle.function("fanClean", cloudFanClean);
    Particle.function("reset", cloudReset);
    Particle.function("altitude", cloudSetAltitude);
    Particle.function("pressure", cloudSetPressure);
    Particle.function("ledBright", cloudSetBrightness);
    Particle.function("aqiSmooth", cloudSetSmoothing);
    Particle.variable("serial", serialNumber);
    Particle.variable("aqi", cloudAqi);
    Particle.variable("aqiRaw", cloudAqiRaw);
    Particle.variable("aqiCat", cloudAqiCat);

    strip.begin();
    strip.setBrightness(ledBrightness);
    strip.clear();
    strip.show();

    // Dim white until the first particulate reading lands.
    for (uint16_t i = 0; i < LED_COUNT; i++) {
        strip.setPixelColor(i, AQI_UNKNOWN.r, AQI_UNKNOWN.g, AQI_UNKNOWN.b);
    }
    strip.show();

    Wire.setSpeed(CLOCK_SPEED_100KHZ);  // SEN66 is a 100 kHz device
    Wire.begin();
    sensor.setRxBufferLimit(WIRE_BUFFER_SIZE);

    if (!sensor.begin()) {
        Log.error("no SEN66 at 0x%02X - check wiring and 3V3 supply",
                  SEN66_I2C_ADDRESS);
    }

    // A reset is not strictly required, but it puts the sensor in a known
    // state after a Boron reflash left it measuring.
    int16_t error = sensor.stopMeasurement();
    if (error != SEN66_OK) {
        Log.warn("stopMeasurement: %s", SEN66::errorString(error));
    }

    error = sensor.getSerialNumber(serialNumber, sizeof(serialNumber));
    if (error == SEN66_OK) {
        Log.info("SEN66 serial number: %s", serialNumber);
    } else {
        Log.warn("getSerialNumber: %s", SEN66::errorString(error));
    }

    logStatus();

    error = sensor.startContinuousMeasurement();
    if (error != SEN66_OK) {
        Log.error("startContinuousMeasurement: %s", SEN66::errorString(error));
    }
    measurementStartedAt = millis();
    lastPublish = millis();
}

void loop() {
    if (millis() - lastSample < SAMPLE_INTERVAL) {
        return;
    }
    lastSample = millis();

    SEN66Measurement m;
    int16_t error = sensor.readMeasuredValues(m);
    if (error == SEN66_ERR_NOT_READY) {
        return;
    }
    if (error != SEN66_OK) {
        Log.warn("readMeasuredValues: %s", SEN66::errorString(error));
        return;
    }

    latest = m;
    haveMeasurement = true;
    updateEma(m);
    updateIndicator(m);
    printMeasurement(m);

    const bool warmedUp = millis() - measurementStartedAt > WARMUP_MS;
    if (warmedUp && haveMeasurement &&
        millis() - lastPublish >= PUBLISH_INTERVAL) {
        lastPublish = millis();
        if (!Particle.connected()) {
            Log.warn("not connected - skipping publish");
        } else if (!Time.isValid()) {
            // Without a synced clock the "ts" field would be meaningless, and
            // the webhook would write to a garbage RTDB key.
            Log.warn("clock not synced yet - skipping publish");
        } else {
            publishMeasurement(latest);
        }
        logStatus();
    }
}
