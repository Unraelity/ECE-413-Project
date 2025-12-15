// SYSTEM_MODE(AUTOMATIC);
SYSTEM_THREAD(ENABLED);

#include <Wire.h>
#include "MAX30105.h"
#include <math.h>

MAX30105 particleSensor;

float beatsPerMinute = 0;
const int led = D7;  // on-board LED

const int SPO2_SAMPLES = 50;     // more = smoother but slower
const long FINGER_IR_THRESHOLD = 10000;

// Quick-and-dirty SpO2 estimate using ratio-of-ratios:
// R = (ACred/DCred) / (ACir/DCir)
// SpO2 ≈ 110 - 25*R  (common rough approximation)
float estimateSpO2Burst() {
    int count = 0;

    // Welford's algorithm for mean + variance (AC ≈ stddev, DC ≈ mean)
    double meanRed = 0, m2Red = 0;
    double meanIR  = 0, m2IR  = 0;

    while (count < SPO2_SAMPLES) {
        particleSensor.check(); // load new samples into FIFO

        while (particleSensor.available() && count < SPO2_SAMPLES) {
            long red = particleSensor.getRed();
            long ir  = particleSensor.getIR();
            particleSensor.nextSample();

            count++;

            // update RED
            double dr = red - meanRed;
            meanRed += dr / count;
            m2Red   += dr * (red - meanRed);

            // update IR
            double di = ir - meanIR;
            meanIR += di / count;
            m2IR   += di * (ir - meanIR);
        }
        delay(1); // tiny yield
    }

    if (count < 2) return 0.0f;

    double stdRed = sqrt(m2Red / (count - 1));
    double stdIR  = sqrt(m2IR  / (count - 1));

    if (meanRed <= 0 || meanIR <= 0 || stdIR <= 0) return 0.0f;

    double R = (stdRed / meanRed) / (stdIR / meanIR);
    double spo2 = 110.0 - 25.0 * R;

    // clamp
    if (spo2 < 0) spo2 = 0;
    if (spo2 > 100) spo2 = 100;

    return (float)spo2;
}

void handle(const char *event, const char *data) { }

void setup() {
    pinMode(led, OUTPUT);

    Serial.begin(9600);
    waitFor(Serial.isConnected, 10000);
    delay(500);

    Serial.println("Initializing MAX30105...");

    Particle.subscribe("hook-response/temp", handle, MY_DEVICES);

    if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
        Serial.println("MAX30105 was not found. Please check wiring/power.");
        while (1) {
            digitalWrite(led, HIGH); delay(200);
            digitalWrite(led, LOW);  delay(200);
        }
    }

    Serial.println("MAX30105 initialized, starting loop.");

    particleSensor.setup(); // keep this simple

    particleSensor.setPulseAmplitudeRed(0x1F);
    particleSensor.setPulseAmplitudeIR(0x1F);
    particleSensor.setPulseAmplitudeGreen(0);
}

void loop() {
    digitalWrite(led, HIGH);

    long irValue = particleSensor.getIR();
    float spo2 = 0.0f;

    if (irValue > FINGER_IR_THRESHOLD) {
        // keep your existing simple BPM estimate (UNCHANGED)
        beatsPerMinute = irValue / 1831.0;

        // NEW: try computing SpO2 from burst of samples
        spo2 = estimateSpO2Burst();

        Serial.printlnf("Finger detected (IR: %ld) -> HR: %.1f, SpO2: %.1f",
                        irValue, beatsPerMinute, spo2);
    } else {
        beatsPerMinute = 0;
        spo2 = 0;
        Serial.printlnf("No finger detected (IR: %ld)", irValue);
    }

    // Publish BOTH values as JSON
    String payload = String::format("{\"hr\":%.1f,\"spo2\":%.1f}", beatsPerMinute, spo2);
    Particle.publish("temp", payload, PRIVATE);
    Serial.printlnf("Published: %s", payload.c_str());

    delay(2000);
}