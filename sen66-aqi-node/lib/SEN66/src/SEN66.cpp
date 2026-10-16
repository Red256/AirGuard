#include "SEN66.h"

namespace {

// Command IDs (from SensirionI2cSen66.h v1.3.1)
const uint16_t CMD_START_CONTINUOUS_MEASUREMENT = 0x0021;
const uint16_t CMD_STOP_MEASUREMENT = 0x0104;
const uint16_t CMD_GET_DATA_READY = 0x0202;
const uint16_t CMD_READ_MEASURED_VALUES = 0x0300;
const uint16_t CMD_START_FAN_CLEANING = 0x5607;
const uint16_t CMD_SET_TEMPERATURE_OFFSET = 0x60B2;
const uint16_t CMD_CO2_AUTO_SELF_CAL = 0x6711;
const uint16_t CMD_AMBIENT_PRESSURE = 0x6720;
const uint16_t CMD_SENSOR_ALTITUDE = 0x6736;
const uint16_t CMD_GET_PRODUCT_NAME = 0xD014;
const uint16_t CMD_GET_SERIAL_NUMBER = 0xD033;
const uint16_t CMD_READ_DEVICE_STATUS = 0xD206;
const uint16_t CMD_READ_AND_CLEAR_DEVICE_STATUS = 0xD210;
const uint16_t CMD_DEVICE_RESET = 0xD304;

// Longest response we read as words: 48 bytes = 16 words (product name).
const size_t MAX_WORDS = 16;

}  // namespace

SEN66::SEN66(TwoWire& bus, uint8_t address)
    : _bus(bus), _address(address), _rxLimit(32) {
}

bool SEN66::begin() {
    if (!_bus.isEnabled()) {
        _bus.begin();
    }
    _bus.beginTransmission(_address);
    return _bus.endTransmission() == 0;
}

uint8_t SEN66::crc8(const uint8_t* data, size_t len) {
    // CRC-8, polynomial 0x31, init 0xFF, no final XOR (Sensirion standard).
    uint8_t crc = 0xFF;
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (uint8_t bit = 0; bit < 8; bit++) {
            crc = (crc & 0x80) ? (uint8_t)((crc << 1) ^ 0x31) : (uint8_t)(crc << 1);
        }
    }
    return crc;
}

int16_t SEN66::sendCommand(uint16_t command, uint32_t execMs,
                           const uint16_t* args, size_t argCount) {
    _bus.beginTransmission(_address);
    _bus.write((uint8_t)(command >> 8));
    _bus.write((uint8_t)(command & 0xFF));
    for (size_t i = 0; i < argCount; i++) {
        uint8_t word[2] = {(uint8_t)(args[i] >> 8), (uint8_t)(args[i] & 0xFF)};
        _bus.write(word[0]);
        _bus.write(word[1]);
        _bus.write(crc8(word, 2));
    }
    if (_bus.endTransmission() != 0) {
        return SEN66_ERR_WRITE;
    }
    if (execMs > 0) {
        delay(execMs);
    }
    return SEN66_OK;
}

int16_t SEN66::readWords(uint16_t* words, size_t wordCount) {
    const size_t byteCount = wordCount * 3;
    if (byteCount > _rxLimit) {
        // Particle's default Wire RX buffer is 32 bytes. Responses larger than
        // that need acquireWireBuffer() in the application plus a matching
        // setRxBufferLimit() here (see README).
        return SEN66_ERR_BUFFER;
    }
    if (_bus.requestFrom(_address, (uint8_t)byteCount) != byteCount) {
        return SEN66_ERR_READ;
    }
    for (size_t i = 0; i < wordCount; i++) {
        uint8_t frame[2];
        frame[0] = _bus.read();
        frame[1] = _bus.read();
        uint8_t crc = _bus.read();
        if (crc8(frame, 2) != crc) {
            return SEN66_ERR_CRC;
        }
        words[i] = (uint16_t)(frame[0] << 8) | frame[1];
    }
    return SEN66_OK;
}

int16_t SEN66::transfer(uint16_t command, uint32_t execMs, uint16_t* words,
                        size_t wordCount) {
    int16_t error = sendCommand(command, execMs);
    if (error != SEN66_OK) {
        return error;
    }
    return readWords(words, wordCount);
}

int16_t SEN66::startContinuousMeasurement() {
    return sendCommand(CMD_START_CONTINUOUS_MEASUREMENT, 50);
}

int16_t SEN66::stopMeasurement() {
    return sendCommand(CMD_STOP_MEASUREMENT, 1400);
}

int16_t SEN66::deviceReset() {
    return sendCommand(CMD_DEVICE_RESET, 1200);
}

int16_t SEN66::startFanCleaning() {
    return sendCommand(CMD_START_FAN_CLEANING, 20);
}

int16_t SEN66::getDataReady(bool& ready) {
    uint16_t word = 0;
    int16_t error = transfer(CMD_GET_DATA_READY, 20, &word, 1);
    if (error != SEN66_OK) {
        return error;
    }
    // High byte is padding; low byte is the flag.
    ready = (word & 0x00FF) != 0;
    return SEN66_OK;
}

int16_t SEN66::readMeasuredValues(SEN66Measurement& out) {
    bool ready = false;
    int16_t error = getDataReady(ready);
    if (error != SEN66_OK) {
        return error;
    }
    if (!ready) {
        return SEN66_ERR_NOT_READY;
    }

    uint16_t raw[9] = {0};
    error = transfer(CMD_READ_MEASURED_VALUES, 20, raw, 9);
    if (error != SEN66_OK) {
        return error;
    }

    out = SEN66Measurement();
    out.pmValid = raw[0] != SEN66_INVALID_U16;
    if (out.pmValid) {
        out.pm1p0 = raw[0] / 10.0f;
        out.pm2p5 = raw[1] / 10.0f;
        out.pm4p0 = raw[2] / 10.0f;
        out.pm10p0 = raw[3] / 10.0f;
    }

    int16_t rh = (int16_t)raw[4];
    int16_t temp = (int16_t)raw[5];
    out.rhtValid = (raw[4] != SEN66_INVALID_I16) && (raw[5] != SEN66_INVALID_I16);
    if (out.rhtValid) {
        out.humidity = rh / 100.0f;
        out.temperature = temp / 200.0f;
    }

    out.vocValid = raw[6] != SEN66_INVALID_I16;
    if (out.vocValid) {
        out.vocIndex = (int16_t)raw[6] / 10.0f;
    }

    out.noxValid = raw[7] != SEN66_INVALID_I16;
    if (out.noxValid) {
        out.noxIndex = (int16_t)raw[7] / 10.0f;
    }

    out.co2Valid = raw[8] != SEN66_INVALID_U16;
    if (out.co2Valid) {
        out.co2 = raw[8];
    }

    return SEN66_OK;
}

int16_t SEN66::readString(uint16_t command, char* out, size_t outLen) {
    if (out == nullptr || outLen == 0) {
        return SEN66_ERR_BUFFER;
    }
    uint16_t words[MAX_WORDS] = {0};
    int16_t error = transfer(command, 20, words, MAX_WORDS);
    if (error != SEN66_OK) {
        out[0] = '\0';
        return error;
    }
    // 32 ASCII characters, null-terminated by the sensor.
    size_t n = 0;
    for (size_t i = 0; i < MAX_WORDS && n + 1 < outLen; i++) {
        char hi = (char)(words[i] >> 8);
        if (hi == '\0') {
            break;
        }
        out[n++] = hi;
        char lo = (char)(words[i] & 0xFF);
        if (lo == '\0' || n + 1 >= outLen) {
            break;
        }
        out[n++] = lo;
    }
    out[n] = '\0';
    return SEN66_OK;
}

int16_t SEN66::getSerialNumber(char* out, size_t outLen) {
    return readString(CMD_GET_SERIAL_NUMBER, out, outLen);
}

int16_t SEN66::getProductName(char* out, size_t outLen) {
    return readString(CMD_GET_PRODUCT_NAME, out, outLen);
}

int16_t SEN66::readStatus(uint16_t command, SEN66Status& out) {
    uint16_t words[2] = {0};
    int16_t error = transfer(command, 20, words, 2);
    if (error != SEN66_OK) {
        return error;
    }
    out = SEN66Status();
    out.raw = ((uint32_t)words[0] << 16) | words[1];
    out.fanError = (out.raw >> 4) & 0x1;
    out.rhtError = (out.raw >> 6) & 0x1;
    out.gasError = (out.raw >> 7) & 0x1;
    out.co2Error = ((out.raw >> 9) & 0x1) || ((out.raw >> 12) & 0x1);
    out.pmError = (out.raw >> 11) & 0x1;
    out.fanSpeedWarning = (out.raw >> 21) & 0x1;
    return SEN66_OK;
}

int16_t SEN66::readDeviceStatus(SEN66Status& out) {
    return readStatus(CMD_READ_DEVICE_STATUS, out);
}

int16_t SEN66::readAndClearDeviceStatus(SEN66Status& out) {
    return readStatus(CMD_READ_AND_CLEAR_DEVICE_STATUS, out);
}

int16_t SEN66::setAmbientPressure(uint16_t hPa) {
    return sendCommand(CMD_AMBIENT_PRESSURE, 20, &hPa, 1);
}

int16_t SEN66::setSensorAltitude(uint16_t metres) {
    return sendCommand(CMD_SENSOR_ALTITUDE, 20, &metres, 1);
}

int16_t SEN66::setCo2AutoSelfCalibration(bool enabled) {
    uint16_t value = enabled ? 1 : 0;
    return sendCommand(CMD_CO2_AUTO_SELF_CAL, 20, &value, 1);
}

int16_t SEN66::setTemperatureOffsetSimple(float offsetC) {
    // offset [0.1 degC], slope 0, time constant 0 (instant), slot 0.
    uint16_t args[4] = {(uint16_t)(int16_t)lroundf(offsetC * 10.0f), 0, 0, 0};
    return sendCommand(CMD_SET_TEMPERATURE_OFFSET, 20, args, 4);
}

const char* SEN66::errorString(int16_t error) {
    switch (error) {
        case SEN66_OK:
            return "ok";
        case SEN66_ERR_WRITE:
            return "I2C write failed (no ACK / wiring)";
        case SEN66_ERR_READ:
            return "I2C read short (sensor busy?)";
        case SEN66_ERR_CRC:
            return "CRC mismatch";
        case SEN66_ERR_BUFFER:
            return "Wire buffer too small for response";
        case SEN66_ERR_NOT_READY:
            return "no new measurement ready";
        default:
            return "unknown error";
    }
}
