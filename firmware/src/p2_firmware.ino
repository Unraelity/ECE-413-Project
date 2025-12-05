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
    Serial.println("Initializing MAX30105...");

    // subscribe to webhook responses (not strictly required for project)
    Particle.subscribe("hook-response/bpm", handle, MY_DEVICES);

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
    particleSensor.setup(); 
}

void loop() {
    digitalWrite(led, HIGH);

    // read IR value (used as proxy here for “finger present”)
    long irValue = particleSensor.getIR();

    // simple threshold to check if a finger is on the sensor
    if (irValue > 10000) {
        // your approximate BPM calculation
        beatsPerMinute = irValue / 1831.0;

        // publish BPM as the event value
        // Webhook will map this to "hr" and set spo2 in the template
        Particle.publish("activity", String(beatsPerMinute), PRIVATE);
        Serial.printlnf("Published activity: %0.1f bpm (IR: %ld)", beatsPerMinute, irValue);
    } else {
        Serial.printlnf("No finger detected (IR: %ld)", irValue);
    }

    delay(2000); // 2 seconds between samples/publishes
}
