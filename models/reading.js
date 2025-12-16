// models/reading.js
// Defines the Reading schema/model (HR + SpO2 measurements) in MongoDB via Mongoose.

const db = require("../db"); // Shared Mongoose connection

// A Reading document represents one measurement event from a device
const ReadingSchema = new db.Schema(
  {
    // Which device produced this reading (foreign key to Device)
    deviceId: {
      type: db.Types.ObjectId,
      ref: "Device",   // enables populate("deviceId") if you need device info
      index: true,     // index for faster queries filtering by deviceId
      required: true
    },

    // Timestamp for the reading (defaults to now if not provided)
    // Also indexed because you frequently sort/filter by time (ts)
    ts: {
      type: Date,
      default: Date.now,
      index: true
    },

    // Heart rate value (beats per minute)
    hr: { type: Number, required: true },

    // Blood oxygen saturation (percentage)
    spo2: { type: Number, required: true }
  },
  {
    // Disables the "__v" version field
    versionKey: false
  }
);

// Export the model (collection name will be "readings" by default)
module.exports = db.model("Reading", ReadingSchema);