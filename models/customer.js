// models/customer.js
// Defines the Customer schema/model (users) in MongoDB via Mongoose.

const db = require("../db"); // Your shared Mongoose connection (db/mongoose instance)

// Define the shape of a Customer document in MongoDB
const CustomerSchema = new db.Schema(
  {
    // User email (must exist, and must be unique across all customers)
    email: { type: String, unique: true, required: true },

    // Store a bcrypt hash of the password (never store the raw password)
    passwordHash: { type: String, required: true },

    // Timestamp of the user's last login/access (defaults to "now" at creation)
    lastAccess: { type: Date, default: Date.now },

    // Schedule window start time (stored as "HH:MM" string)
    startTime: { type: String, default: "06:00" },

    // Schedule window end time (stored as "HH:MM" string)
    endTime: { type: String, default: "22:00" },

    // How often to prompt / expect readings (in minutes)
    freqMins: { type: Number, default: 30 }
  },
  {
    // Disables the "__v" field that Mongoose normally adds for versioning
    versionKey: false
  }
);

// Create and export the Mongoose model:
// - Collection name will be "customers" (pluralized by Mongoose by default)
module.exports = db.model("Customer", CustomerSchema);