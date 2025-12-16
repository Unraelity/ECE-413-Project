// models/device.js
// Defines the Device schema/model (registered hardware devices) in MongoDB via Mongoose.

const db = require("../db"); // Shared Mongoose connection

// A Device document represents a single registered device (e.g., a Particle P2)
const DeviceSchema = new db.Schema(
  {
    // Owner of this device (links device -> customer/user)
    // Stored as an ObjectId pointing to a Customer document
    ownerId: {
      type: db.Types.ObjectId,
      ref: "Customer",   // enables population (Device.find(...).populate("ownerId"))
      index: true,       // index for faster queries like find({ ownerId: ... })
      required: true
    },

    // Friendly name shown in the UI (e.g., "Nick's Heart Track")
    name: { type: String, required: true },

    // Optional API key field (unique if present)
    // sparse:true means uniqueness is enforced only for docs where apiKey exists
    apiKey: { type: String, unique: true, sparse: true },

    // Particle Device ID (optional, but must be unique if present)
    // sparse:true allows multiple docs with null/undefined particleId
    particleId: { type: String, unique: true, sparse: true }
  },
  {
    // Disables the "__v" version field
    versionKey: false
  }
);

// Export the model (collection name will be "devices" by default)
module.exports = db.model("Device", DeviceSchema);