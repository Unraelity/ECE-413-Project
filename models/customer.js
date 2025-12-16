const db = require("../db");

const CustomerSchema = new db.Schema({
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    lastAccess: { type: Date, default: Date.now },
    startTime: { type: String, default: "06:00" },
    endTime:   { type: String, default: "22:00" },
    freqMins:  { type: Number, default: 30 }

}, { versionKey: false });

module.exports = db.model("Customer", CustomerSchema);