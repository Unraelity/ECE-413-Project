// SYSTEM_MODE(AUTOMATIC);
SYSTEM_THREAD(ENABLED);

#include <Wire.h>
#include "MAX30105.h"

MAX30105 particleSensor;

float beatsPerMinute = 0;
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
    
    Serial.println("MAX30105 initialized, starting loop.");
    // Use default sensor configuration
    particleSensor.setup(); 
}

void loop() {
    digitalWrite(led, HIGH);

    long irValue = particleSensor.getIR();

    float hr = 0.0;
    float spo2 = 97.5; // placeholder until real algorithm

    if (irValue > 10000) {
        beatsPerMinute = irValue / 1831.0;
        hr = beatsPerMinute;
        Serial.printlnf("Finger detected (IR: %ld)", irValue);
    } else {
        Serial.printlnf("No finger (IR: %ld)", irValue);
    }

    char payload[64];
    snprintf(payload, sizeof(payload), "%.1f,%.1f", hr, spo2);

    Particle.publish("temp", payload, PRIVATE);
    Serial.printlnf("Published: %s", payload);

    delay(2000);
}