// db/mongoose.js (or wherever this file lives)
// Centralized MongoDB connection setup using Mongoose.

const mongoose = require("mongoose"); // ODM (Object Data Modeling) library for MongoDB

// strictQuery controls how Mongoose treats filter properties that are not in the schema.
// true = only allow fields defined in schema (helps avoid accidental query typos / injection-y filters)
mongoose.set('strictQuery', true);

// Connect to local MongoDB instance, database name: "authen"
// mongodb://127.0.0.1 = local machine
// Options:
// - useNewUrlParser: use the new connection string parser
// - useUnifiedTopology: use the new unified topology engine
mongoose.connect(
  "mongodb://127.0.0.1/authen",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

// Export the mongoose instance so other files can import it
// (models will use this connection automatically once required)
module.exports = mongoose;