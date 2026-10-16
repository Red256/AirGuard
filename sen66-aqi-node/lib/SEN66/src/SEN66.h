/*
 * SEN66.h - Particle driver for the Sensirion SEN66 environmental sensor node
 *
 * Self-contained port of the SEN66 I2C protocol for Particle Device OS
 * (Boron / B-SoM / Argon / Photon 2). No external library dependencies:
 * everything the Sensirion Arduino driver pulls in from SensirionCore
 * (frame building, CRC-8, error codes) is implemented here against
 * Particle's TwoWire.
 *
 * Command IDs, execution delays and signal scaling follow
 * https://github.com/Sensirion/arduino-i2c-sen66 (v1.3.1) and the
 * SEN6x datasheet.
 */

#ifndef SEN66_H
#define SEN66_H

#include "Particle.h"

#define SEN66_I2C_ADDRESS 0x6B

// Raw values the sensor reports when a signal is not (yet) available.
#define SEN66_INVALID_U16 0xFFFF
#define SEN66_INVALID_I16 0x7FFF

enum SEN66Error : int16_t {
    SEN66_OK = 0,
    SEN66_ERR_WRITE = -1,       // I2C write (NACK / bus error)
    SEN66_ERR_READ = -2,        // fewer bytes returned than requested
    SEN66_ERR_CRC = -3,         // CRC-8 mismatch in response
    SEN66_ERR_BUFFER = -4,      // response does not fit the Wire RX buffer
    SEN66_ERR_NOT_READY = -5,   // no new measurement available
};

// One set of measured values. Scaling already applied.
// Each *_valid flag is false when the sensor reported the "unknown" raw value
// (normal during the first seconds after startContinuousMeasurement()).
struct SEN66Measurement {
    float pm1p0 = NAN;        // ug/m3
    float pm2p5 = NAN;        // ug/m3
    float pm4p0 = NAN;        // ug/m3
    float pm10p0 = NAN;       // ug/m3
    float humidity = NAN;     // %RH
    float temperature = NAN;  // degC
    float vocIndex = NAN;     // 1..500 index
    float noxIndex = NAN;     // 1..500 index
    uint16_t co2 = 0;         // ppm

    bool pmValid = false;
    bool rhtValid = false;
    bool vocValid = false;
    bool noxValid = false;
    bool co2Valid = false;
};

// Decoded device status word (command 0xD206). See SEN6x datasheet, 6.4.
struct SEN66Status {
    uint32_t raw = 0;
    bool fanError = false;
    bool rhtError = false;
    bool gasError = false;
    bool co2Error = false;
    bool pmError = false;
    bool fanSpeedWarning = false;

    bool anyError() const {
        return fanError || rhtError || gasError || co2Error || pmError;
    }
};

class SEN66 {
  public:
    explicit SEN66(TwoWire& bus = Wire, uint8_t address = SEN66_I2C_ADDRESS);

    // Starts the I2C bus (if not already running) and checks that the sensor
    // acknowledges its address. Returns false if nothing answers.
    bool begin();

    // --- measurement control -------------------------------------------
    int16_t startContinuousMeasurement();  // 1 Hz updates, ~50 ms
    int16_t stopMeasurement();             // blocks ~1400 ms
    int16_t deviceReset();                 // soft reset, blocks ~1200 ms
    int16_t startFanCleaning();            // runs ~10 s in the background

    // --- data readout ---------------------------------------------------
    int16_t getDataReady(bool& ready);
    // Returns SEN66_ERR_NOT_READY if no new sample is pending.
    int16_t readMeasuredValues(SEN66Measurement& out);

    // --- device info / status -------------------------------------------
    // NOTE: these responses are 48 bytes and need an enlarged Wire RX buffer
    // (see acquireWireBuffer() in the application).
    int16_t getSerialNumber(char* out, size_t outLen);
    int16_t getProductName(char* out, size_t outLen);
    int16_t readDeviceStatus(SEN66Status& out);
    int16_t readAndClearDeviceStatus(SEN66Status& out);

    // --- configuration ---------------------------------------------------
    // CO2 compensation: set one of these, not both. Must be set while idle
    // for altitude; pressure may be updated during measurement.
    int16_t setAmbientPressure(uint16_t hPa);          // 700..1200 hPa
    int16_t setSensorAltitude(uint16_t metres);        // 0..3000 m
    int16_t setCo2AutoSelfCalibration(bool enabled);
    int16_t setTemperatureOffsetSimple(float offsetC);  // degC, slot 0

    static const char* errorString(int16_t error);

    // How many bytes a single Wire.requestFrom() may fetch. Defaults to
    // Particle's 32-byte buffer; raise it to match acquireWireBuffer() so the
    // 48-byte serial-number / product-name responses can be read.
    void setRxBufferLimit(size_t bytes) {
        _rxLimit = bytes;
    }

  private:
    TwoWire& _bus;
    uint8_t _address;
    size_t _rxLimit;

    static uint8_t crc8(const uint8_t* data, size_t len);

    // Sends a command, optionally with `argCount` 16-bit arguments (each
    // followed by its CRC), then waits `execMs`.
    int16_t sendCommand(uint16_t command, uint32_t execMs,
                        const uint16_t* args = nullptr, size_t argCount = 0);

    // Reads `wordCount` 16-bit words (3 bytes each on the wire) and verifies
    // every CRC.
    int16_t readWords(uint16_t* words, size_t wordCount);

    int16_t transfer(uint16_t command, uint32_t execMs, uint16_t* words,
                     size_t wordCount);
    int16_t readString(uint16_t command, char* out, size_t outLen);
    int16_t readStatus(uint16_t command, SEN66Status& out);
};

#endif  // SEN66_H
