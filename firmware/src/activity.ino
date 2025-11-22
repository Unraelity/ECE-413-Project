
// SYSTEM_MODE(AUTOMATIC);
SYSTEM_THREAD(ENABLED); //uncomment to use w/out wifi

#include <Wire.h>
#include "MAX30105.h"
long lastBeat = 0; //Time at which the last beat occurred
float beatsPerMinute;
MAX30105 particleSensor;

void handle(const char *event, const char *data){

}
int led = D7;  // The on-board LED

void setup()
{
    Serial.begin(9600);
    Serial.println("Initializing...");

    //subscriptions to Particle Webhooks
    Particle.subscribe("hook-response/bpm", handle, MY_DEVICES);

    // Initialize sensor
    if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) //Use default I2C port, 400kHz speed
    {
        Serial.println("MAX30105 was not found. Please check wiring/power. ");
        while (1);
    }
    // Serial.println("Place your index finger on the sensor with steady pressure.");

    particleSensor.setup(); //Configure sensor with default settings

}


void loop() {
    
    digitalWrite(led, HIGH);   // Turn ON the LED
  
    long irValue = particleSensor.getIR();
    delay(2000);
    
    if(irValue > 10000){
        // long delta = millis() - lastBeat;
        // lastBeat = millis();
        // beatsPerMinute = 60 / (delta / 1000.0);        
        beatsPerMinute = irValue/1831.0;
        Particle.publish("activity", String(beatsPerMinute), PRIVATE);
    }
   
}



