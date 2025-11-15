const db = require("../db");

const ReadingSchema = new db.Schema({
    deviceId: { type: db.Types.ObjectId, ref: "Device", index: true, required: true },
    ts: { type: Date, default: Date.now, index: true },
    hr: { type: Number, required: true },
    spo2: { type: Number, required: true }
}, { versionKey: false });

module.exports = db.model("Reading", ReadingSchema);