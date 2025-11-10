const db = require("../db");

const UserSchema = new db.Schema({
    ownerId: { type: mongoose.Types.ObjectId, ref: 'User', index: true, required: true },
    name: { type: String, required: true },
    apiKey: { type: String, unique: true, required: true },
}, { versionKey: false });

const User = db.model("Customer", customerSchema);

module.exports = User;