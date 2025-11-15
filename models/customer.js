const db = require("../db");

const CustomerSchema = new db.Schema({
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    lastAccess: { type: Date, default: Date.now }
}, { versionKey: false });

module.exports = db.model("Customer", CustomerSchema);