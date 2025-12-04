// to use mongoDB
const mongoose = require("mongoose");
require('dotenv').config();


mongoose.set('strictQuery', true);

const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1/authen";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology:true });

module.exports = mongoose;