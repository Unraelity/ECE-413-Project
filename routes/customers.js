// customers.js (routes)
// Handles: sign up, log in, auth status, and measurement schedule settings

var express = require('express');
var router = express.Router();

var Customer = require("../models/customer"); // Mongoose model for customers/users

const jwt = require("jwt-simple");            // Simple JWT encode/decode
const bcrypt = require("bcryptjs");           // Password hashing + comparison
const auth = require("../middleware/auth");   // Your JWT auth middleware (sets req.user)
const fs = require('fs');                     // Read secret key from file

/**
 * Basic password strength checker:
 * - >= 8 chars
 * - at least 1 lowercase, 1 uppercase, 1 digit, 1 special
 */
function isStrongPassword(pw) {
  // strong password is at least 8 characterss, at least 1 lowercase, 1 uppercase, 1 number and 1 special
  return typeof pw === "string"
    && pw.length >= 8
    && /[a-z]/.test(pw)
    && /[A-Z]/.test(pw)
    && /\d/.test(pw)
    && /[^A-Za-z0-9]/.test(pw);
}

// JWT signing/verification secret (read from keys/jwtkey)
const secret = fs.readFileSync(__dirname + '/../keys/jwtkey').toString();

// ==========================================================
// SIGN UP
// ==========================================================
// POST /customers/signUp
// Expects body: { email, password }
// Creates a new customer with a bcrypt password hash.
router.post("/signUp", function (req, res) {

  // Check if a customer already exists with the submitted email
  Customer.findOne({ email: req.body.email }, function (err, customer) {

    // DB error (401 is a bit unusual for DB errors; often 500/400)
    if (err) res.status(401).json({ success: false, err: err });

    // Email already in use
    else if (customer) {
      res.status(401).json({ success: false, msg: "This email already used" });
    }

    // Create new account
    else {
      // Hash the password (salt rounds = 10)
      const passwordHash = bcrypt.hashSync(req.body.password, 10);

      // Build the new Customer document (store hash, NOT raw password)
      const newCustomer = new Customer({
        email: req.body.email,
        passwordHash: passwordHash
      });

      // Save to MongoDB
      newCustomer.save(function (err, customer) {
        if (err) {
          // Validation/DB save error
          res.status(400).json({ success: false, err: err });
        }
        // Password-strength check (NOTE: currently happens AFTER saving)
        // Ideally you'd validate BEFORE saving so weak passwords never get stored.
        else if (!isStrongPassword(req.body.password)) {
          return res.status(400).json({
            success: false,
            msg: "Password must have at least 8 characters with uppercase, lowercase, number, and special character."
          });
        }
        // Success response
        else {
          let msgStr = `Customer (${req.body.email}) account has been created.`;
          res.status(201).json({ success: true, message: msgStr });
          console.log(msgStr);
        }
      });
    }
  });
});

// ==========================================================
// LOG IN
// ==========================================================
// POST /customers/logIn
// Expects body: { email, password }
// If credentials are valid, returns JWT token.
router.post("/logIn", function (req, res) {

  // Simple input validation
  if (!req.body.email || !req.body.password) {
    res.status(401).json({ error: "Missing email and/or password" });
    return;
  }

  // Look up user by email
  Customer.findOne({ email: req.body.email }, function (err, customer) {

    if (err) {
      // DB error
      res.status(400).send(err);
    }
    else if (!customer) {
      // No matching user in DB
      res.status(401).json({ error: "Login failure!!" });
    }
    else {
      // Compare plaintext password to stored bcrypt hash
      if (bcrypt.compareSync(req.body.password, customer.passwordHash)) {

        // Create a token containing the user's email
        const token = jwt.encode({ email: customer.email }, secret);

        // Update lastAccess timestamp
        customer.lastAccess = new Date();
        customer.save((err, customer) => {
          console.log("User's LastAccess has been update.");
        });

        // Return token to client
        res.status(201).json({ success: true, token: token, msg: "Login success" });
      }
      else {
        // Wrong password
        res.status(401).json({ success: false, msg: "Email or password invalid." });
      }
    }
  });
});

// ==========================================================
// STATUS (token-based auth example WITHOUT middleware)
// ==========================================================
// GET /customers/status
// Reads x-auth header directly, decodes JWT, returns email + lastAccess.
router.get("/status", function (req, res) {

  // Check header exists
  if (!req.headers["x-auth"]) {
    return res.status(401).json({ success: false, msg: "Missing X-Auth header" });
  }

  // Extract token from header
  const token = req.headers["x-auth"];

  try {
    // Decode JWT payload (expects { email: ... })
    const decoded = jwt.decode(token, secret);

    // Find the user by decoded email and return just email + lastAccess fields
    Customer.find({ email: decoded.email }, "email lastAccess", function (err, users) {
      if (err) {
        res.status(400).json({ success: false, message: "Error contacting DB. Please contact support." });
      }
      else {
        res.status(200).json(users);
      }
    });
  }
  catch (ex) {
    // jwt.decode failed => token invalid/wrong secret/malformed
    res.status(401).json({ success: false, message: "Invalid JWT" });
  }
});

// ==========================================================
// MEASUREMENT SCHEDULE SETTINGS (uses auth middleware)
// ==========================================================

// GET /customers/settings
// Returns the user's measurement frequency (freqMins) or defaults to 30.
router.get("/settings", auth, async (req, res) => {
  try {
    // req.user.email comes from auth middleware decoding the JWT
    const me = await Customer.findOne({ email: req.user.email }).select("freqMins");
    if (!me) return res.status(404).json({ error: "User not found" });

    return res.json({
      // If freqMins missing/invalid, fallback to 30
      freqMins: Number.isFinite(me.freqMins) ? me.freqMins : 30
    });
  } catch (e) {
    // Any server/DB error
    return res.status(500).json({ error: e.message });
  }
});

// PUT /customers/settings
// Updates measurement frequency.
// Expects body: { freqMins: number } with 1 <= freqMins <= 1440.
router.put("/settings", auth, async (req, res) => {
  try {
    // Parse freqMins from body, validate range
    const f = parseInt(req.body?.freqMins, 10);
    if (!Number.isFinite(f) || f < 1 || f > 1440) {
      return res.status(400).json({ error: "freqMins must be between 1 and 1440" });
    }

    // Load customer doc and update
    const me = await Customer.findOne({ email: req.user.email });
    if (!me) return res.status(404).json({ error: "User not found" });

    me.freqMins = f;
    await me.save();

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ==========================================================
// LATEST READING (used for prompting user every N minutes)
// ==========================================================
// GET /customers/latest
// Finds the newest reading for all devices owned by this user.
router.get("/latest", auth, async (req, res) => {

  // NOTE: This re-requires Customer even though it's already required at top.
  // It also relies on Device + Reading but they are NOT imported in this file
  // in the snippet as shown, so those must exist globally or this would error.
  const Customer = require("../models/customer");

  // Find the current user
  const me = await Customer.findOne({ email: req.user.email });

  // Find devices for this user (NOTE: uses ownerId, but earlier code uses customerId)
  // Make sure your Device schema actually uses ownerId, otherwise this will return empty.
  const devs = await Device.find({ ownerId: me._id }).select("_id");

  // Extract ids
  const ids = devs.map(d => d._id);

  // Find newest reading among those device ids
  const last = await Reading.findOne({ deviceId: { $in: ids } })
    .sort({ ts: -1 })
    .select("ts hr spo2"); // only return timestamp + hr + spo2

  // Return the latest reading or null if none exist
  res.json(last || null);
});

// Export router to mount in server (ex: app.use("/customers", router))
module.exports = router;