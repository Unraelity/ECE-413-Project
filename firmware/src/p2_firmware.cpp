/******************************************************/
//       THIS IS A GENERATED FILE - DO NOT EDIT       //
/******************************************************/

#include "Particle.h"
#line 1 "/Users/nicholasbrown/Documents/HeartRateMonitor/src/p2_firmware.ino"
// SYSTEM_MODE(AUTOMATIC);          // (Optional) Default is AUTOMATIC. Device manages Wi-Fi + cloud connection.
void queueInitIfNeeded();
bool queuePop();
void startFlash(uint8_t r, uint8_t g, uint8_t b, uint32_t ms);
void updateFlash();
float estimateSpO2Burst();
void trySendOldest();
void setup();
void loop();
#line 2 "/Users/nicholasbrown/Documents/HeartRateMonitor/src/p2_firmware.ino"
SYSTEM_THREAD(ENABLED);             // Runs user loop() in a separate thread so cloud connection can happen in background.

#include <Wire.h>                   // I2C library (used to talk to MAX30105)
#include "MAX30105.h"               // SparkFun MAX30105 sensor library
#include <math.h>                   // sqrt()

MAX30105 particleSensor;            // Sensor object

float beatsPerMinute = 0;           // Current HR estimate (very rough in this example)
const int led = D7;                 // On-board LED pin (we keep it on as a "running" indicator)

// SpO2 burst calculation settings
const int SPO2_SAMPLES = 50;        // How many samples to use for each SpO2 estimate
const long FINGER_IR_THRESHOLD = 10000; // IR threshold: below this => likely no finger present

// -------------------- Queue (offline storage) --------------------
// We store readings in a simple ring buffer so if device is offline it can save readings
// and upload them later when it reconnects.
const uint16_t QUEUE_MAX = 64;      // Maximum number of readings to store locally

// One reading record (HR, SpO2, timestamp)
struct ReadingItem {
  float hr;                         // heart rate
  float spo2;                       // oxygen saturation
  uint32_t ts;                      // timestamp (epoch seconds) or 0 if time not valid
};

// "retained" means these variables survive a reset (and usually brief power loss on some devices)
// so queued readings aren't lost if the device reboots.
retained uint32_t qMagic;           // marker used to detect if retained RAM is initialized
retained ReadingItem qBuf[QUEUE_MAX]; // ring buffer storage
retained uint16_t qHead;            // index of oldest item
retained uint16_t qTail;            // index where next item will be written
retained uint16_t qCount;           // number of items currently stored

static const uint32_t Q_MAGIC = 0x51554555; // "QUEU" in hex-ish; used as an init signature

// Initialize retained queue variables once.
// If qMagic doesn't match, retained memory is "uninitialized" (fresh boot), so we reset indices.
void queueInitIfNeeded() {
  if (qMagic != Q_MAGIC) {
    qMagic = Q_MAGIC;
    qHead = qTail = qCount = 0;
  }
}

// Push a reading into the ring buffer.
// If buffer is full, we drop the oldest item to make room (simple, no blocking).
void queuePush(const ReadingItem &it) {
  if (qCount >= QUEUE_MAX) {            // drop oldest if full
    qHead = (qHead + 1) % QUEUE_MAX;    // advance head (forget oldest)
    qCount--;
  }
  qBuf[qTail] = it;                     // write at tail
  qTail = (qTail + 1) % QUEUE_MAX;      // advance tail with wraparound
  qCount++;                             // increase count
}

// Read (peek) the oldest queued item without removing it.
// Returns true if an item exists, false if queue empty.
bool queuePeek(ReadingItem &out) {
  if (qCount == 0) return false;
  out = qBuf[qHead];
  return true;
}

// Remove the oldest queued item (pop).
// Returns true if removed, false if queue empty.
bool queuePop() {
  if (qCount == 0) return false;
  qHead = (qHead + 1) % QUEUE_MAX;      // advance head
  qCount--;
  return true;
}

// -------------------- RGB LED flash (status feedback) --------------------
// We use the Particle device RGB LED as a simple indicator:
// - GREEN  = publish succeeded (event handed to Particle cloud)
// - YELLOW = offline or publish failed -> stored locally in queue
bool flashActive = false;            // whether a flash is currently active
uint32_t flashOffAtMs = 0;           // time (millis) when flash should turn off

// Start a timed flash of the RGB LED.
void startFlash(uint8_t r, uint8_t g, uint8_t b, uint32_t ms) {
  RGB.color(r, g, b);                // set RGB LED color
  flashActive = true;
  flashOffAtMs = millis() + ms;      // schedule LED to turn off later
}

// Turn off the RGB LED when the flash time expires.
// Called every loop() so it is non-blocking.
void updateFlash() {
  if (flashActive && (int32_t)(millis() - flashOffAtMs) >= 0) {
    RGB.color(0, 0, 0);              // turn off LED
    flashActive = false;
  }
}

// -------------------- SpO2 estimate (ratio-of-ratios style) --------------------
// This is a rough approximation:
// - We gather SPO2_SAMPLES readings
// - Use Welford's algorithm to compute mean (DC) and standard deviation (AC)
// - R = (ACred/DCred) / (ACir/DCir)
// - SpO2 ≈ 110 - 25*R (then clamp to 0..100)
//
// NOTE: This is not medical-grade; it’s a quick estimate for a class project.
float estimateSpO2Burst() {
  int count = 0;

  // Welford running statistics
  double meanRed = 0, m2Red = 0;
  double meanIR  = 0, m2IR  = 0;

  // Collect a burst of samples
  while (count < SPO2_SAMPLES) {
    particleSensor.check();          // load new samples into internal buffer

    while (particleSensor.available() && count < SPO2_SAMPLES) {
      long red = particleSensor.getRed();
      long ir  = particleSensor.getIR();
      particleSensor.nextSample();   // consume this sample

      count++;

      // Update RED mean/variance
      double dr = red - meanRed;
      meanRed += dr / count;
      m2Red   += dr * (red - meanRed);

      // Update IR mean/variance
      double di = ir - meanIR;
      meanIR += di / count;
      m2IR   += di * (ir - meanIR);
    }
    delay(1);                        // tiny yield so we don’t lock up the CPU
  }

  // Need at least 2 samples for stddev
  if (count < 2) return 0.0f;

  // Convert Welford variance accumulator to stddev
  double stdRed = sqrt(m2Red / (count - 1));
  double stdIR  = sqrt(m2IR  / (count - 1));

  // Basic sanity checks to avoid divide-by-zero
  if (meanRed <= 0 || meanIR <= 0 || stdIR <= 0) return 0.0f;

  // Ratio of ratios
  double R = (stdRed / meanRed) / (stdIR / meanIR);

  // Approximate SpO2 from R
  double spo2 = 110.0 - 25.0 * R;

  // Clamp to valid percent range
  if (spo2 < 0) spo2 = 0;
  if (spo2 > 100) spo2 = 100;

  return (float)spo2;
}

// -------------------- Publish throttling --------------------
// Particle events can fail if you publish too fast, especially while draining a backlog.
// So we rate-limit publishes to about 1 per ~1.1 seconds.
const uint32_t SEND_PERIOD_MS = 1100; // minimum time between publishes
uint32_t nextSendAllowedMs = 0;       // earliest time we allow next publish

// Publish one reading to the Particle cloud.
// Returns true if publish succeeded (Particle.publish returned true).
bool publishItem(const ReadingItem &it) {
  // Must be cloud-connected to publish
  if (!Particle.connected()) return false;

  // Throttle publishes so we don't spam events
  if ((int32_t)(millis() - nextSendAllowedMs) < 0) return false;

  // JSON payload to send to webhook/server
  String payload = String::format("{\"hr\":%.1f,\"spo2\":%.1f,\"ts\":%lu}",
                                  it.hr, it.spo2, (unsigned long)it.ts);

  // Publish to Particle Cloud (your webhook listens for "temp")
  if (Particle.publish("temp", payload, PRIVATE)) {
    // Set next allowed publish time
    nextSendAllowedMs = millis() + SEND_PERIOD_MS;

    // Visual confirmation: green flash on successful publish
    startFlash(0, 255, 0, 250);

    // Debug print
    Serial.printlnf("Published: %s", payload.c_str());
    return true;
  }

  // Publish failed
  return false;
}

// Try to send the oldest queued reading (if any).
// If publish succeeds, remove it from the queue.
void trySendOldest() {
  if (!Particle.connected()) return; // need cloud connection
  if (qCount == 0) return;           // nothing to send

  ReadingItem it;
  if (!queuePeek(it)) return;        // safety: peek oldest

  // Attempt publish; if successful, pop the item
  if (publishItem(it)) {
    queuePop(); // remove oldest after successful publish
    Serial.printlnf("Drained one from queue. Remaining=%u", (unsigned)qCount);
  }
}

// -------------------- Setup --------------------
void setup() {
  pinMode(led, OUTPUT);              // configure D7 LED

  // Serial debug
  Serial.begin(9600);
  waitFor(Serial.isConnected, 10000);
  delay(500);

  // Initialize retained queue if needed
  queueInitIfNeeded();

  // Initialize MAX30105 over I2C
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30105 was not found. Please check wiring/power.");
    // Blink D7 forever if sensor not found
    while (1) {
      digitalWrite(led, HIGH); delay(200);
      digitalWrite(led, LOW);  delay(200);
    }
  }

  // Sensor default configuration
  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x1F);   // red LED brightness
  particleSensor.setPulseAmplitudeIR(0x1F);    // IR LED brightness
  particleSensor.setPulseAmplitudeGreen(0);    // green LED off (not used)

  // Take over the device RGB LED for our own status flashes
  RGB.control(true);               // disables normal system status LED patterns
  RGB.brightness(96);              // lower brightness (optional)
  RGB.color(0, 0, 0);              // start with LED off
}

// -------------------- Main loop timing --------------------
const uint32_t READ_PERIOD_MS = 2000; // how often to try a new measurement
uint32_t nextReadMs = 0;             // next scheduled read time

// -------------------- Main loop --------------------
void loop() {
  // Keep D7 ON as a "running" indicator
  digitalWrite(led, HIGH);

  // Turn off RGB LED when flash duration is over
  updateFlash();

  // If we are online AND have queued data, prioritize uploading the queue first.
  // We return immediately so we do not generate new readings while backlog exists.
  if (Particle.connected() && qCount > 0) {
    trySendOldest();
    return;
  }

  // Enforce read cadence (non-blocking timing)
  if ((int32_t)(millis() - nextReadMs) < 0) return;
  nextReadMs = millis() + READ_PERIOD_MS;

  // Read IR value (used for both finger detection and rough HR estimate)
  long irValue = particleSensor.getIR();

  // If IR is too low, likely no finger detected
  if (irValue <= FINGER_IR_THRESHOLD) {
    Serial.printlnf("No finger detected (IR: %ld)", irValue);
    return;
  }

  // Compute SpO2 burst estimate
  float spo2 = estimateSpO2Burst();

  // Very rough HR estimate from IR (placeholder logic)
  beatsPerMinute = irValue / 1831.0;

  // Build reading record
  ReadingItem it;
  it.hr = beatsPerMinute;
  it.spo2 = spo2;
  it.ts = Time.isValid() ? (uint32_t)Time.now() : 0; // timestamp if time is synced

  // OFFLINE behavior: queue + yellow flash
  if (!Particle.connected()) {
    queuePush(it);                       // store locally
    startFlash(255, 255, 0, 200);        // YELLOW flash (stored offline)
    Serial.printlnf("Offline -> queued (queueCount=%u)", (unsigned)qCount);
    return;
  }

  // ONLINE behavior (queue empty due to earlier check):
  // publish immediately; green flash happens inside publishItem() when publish succeeds
  if (!publishItem(it)) {
    // If publish fails unexpectedly (even though connected), queue it as a fallback
    queuePush(it);
    startFlash(255, 255, 0, 200);        // YELLOW flash (stored due to failure)
    Serial.printlnf("Publish failed -> queued (queueCount=%u)", (unsigned)qCount);
  }
}