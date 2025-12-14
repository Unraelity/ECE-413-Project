/******************************************************/
//       THIS IS A GENERATED FILE - DO NOT EDIT       //
/******************************************************/

#include "Particle.h"
#line 1 "/Users/nicholasbrown/Documents/HeartRateMonitor/src/p2_firmware.ino"
// SYSTEM_MODE(AUTOMATIC);
void handle(const char *event, const char *data);
void setup();
void loop();
#line 2 "/Users/nicholasbrown/Documents/HeartRateMonitor/src/p2_firmware.ino"
SYSTEM_THREAD(ENABLED);

#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"

MAX30105 particleSensor;

uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];

const int led = D7;  // on-board LED

void handle(const char *event, const char *data) { }

void setup() {
    pinMode(led, OUTPUT);

    Serial.begin(9600);
    waitFor(Serial.isConnected, 10000); // wait up to 10s for USB serial
    delay(500);

    Serial.println("Initializing MAX30105...");

    // subscribe to webhook responses (not strictly required for project)
    Particle.subscribe("hook-response/temp", handle, MY_DEVICES);

    // initialize sensor
    if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
        Serial.println("MAX30105 was not found. Please check wiring/power.");
        // blink LED forever to indicate error
        while (1) {
            digitalWrite(led, HIGH);
            delay(200);
            digitalWrite(led, LOW);
            delay(200);
        }
    }

    // Use default sensor configuration
    particleSensor.setup(0x1F, 4, 2, 100, 411, 4096);

    Serial.println("MAX30105 initialized, starting loop.");
}

void loop() {
  digitalWrite(led, HIGH);

  // Quick “finger present” check (optional)
  particleSensor.check();
  if (!particleSensor.available()) {
    delay(50);
    return;
  }

  // Fill buffers
  for (int i = 0; i < BUFFER_SIZE; i++) {
    while (!particleSensor.available()) particleSensor.check();

    redBuffer[i] = particleSensor.getRed();
    irBuffer[i]  = particleSensor.getIR();

    particleSensor.nextSample();
  }

  int32_t spo2, heartRate;
  int8_t spo2Valid, hrValid;

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, BUFFER_SIZE,
    redBuffer,
    &spo2, &spo2Valid,
    &heartRate, &hrValid
  ); // returns validity flags; invalid SpO2 often shows as -999 :contentReference[oaicite:3]{index=3}

  Serial.printf("HR=%ld (%d)  SpO2=%ld (%d)\n",
                (long)heartRate, (int)hrValid,
                (long)spo2, (int)spo2Valid);

  if (hrValid && spo2Valid) {
    char payload[32];
    snprintf(payload, sizeof(payload), "%ld,%ld", (long)heartRate, (long)spo2);
    Particle.publish("temp", payload, PRIVATE);
    Serial.printf("Published: %s\n", payload);
  }

  delay(2000); // stay well under publish limits :contentReference[oaicite:4]{index=4}
}