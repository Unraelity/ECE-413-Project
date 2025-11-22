const db = require("../db");

const DeviceSchema = new db.Schema({
    ownerId: { type: db.Types.ObjectId, ref: "Customer", index: true, required: true },
    name: { type: String, required: true },
    apiKey: { type: String, unique: true, sparse: true },
    particleId:{ type: String, unique: true, sparse: true } 
}, { versionKey: false });

module.exports = db.model("Device", DeviceSchema);