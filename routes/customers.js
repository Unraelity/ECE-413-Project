var express = require('express');
var router = express.Router();
var Customer = require("../models/customer");
const jwt = require("jwt-simple");
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");
const fs = require('fs');

function isStrongPassword(pw) {
  // strong password is at least 8 characterss, at least 1 lowercase, 1 uppercase, 1 number and 1 special
  return typeof pw === "string"
    && pw.length >= 8
    && /[a-z]/.test(pw)
    && /[A-Z]/.test(pw)
    && /\d/.test(pw)
    && /[^A-Za-z0-9]/.test(pw);
}

const secret = fs.readFileSync(__dirname + '/../keys/jwtkey').toString();

// auth middleware (for this router)
function auth(req, res, next) {
  const token = req.headers["x-auth"];
  if (!token) return res.status(401).json({ error: "Missing X-Auth header" });

  try {
    const decoded = jwt.decode(token, secret); // { email: ... }
    req.user = decoded;
    next();
  } catch (ex) {
    return res.status(401).json({ error: "Invalid JWT" });
  }
}

// example of authentication
// register a new customer

// please fiil in the blanks
// see javascript/signup.js for ajax call
// see Figure 9.3.5: Node.js project uses token-based authentication and password hashing with bcryptjs on zybooks

router.post("/signUp", function (req, res) {
   Customer.findOne({ email: req.body.email }, function (err, customer) {
       if (err) res.status(401).json({ success: false, err: err });
       else if (customer) {
           res.status(401).json({ success: false, msg: "This email already used" });
       }
       else {
           const passwordHash = bcrypt.hashSync(req.body.password, 10);
           const newCustomer = new Customer({
               email: req.body.email,
               passwordHash: passwordHash     
           });

            newCustomer.save(function (err, customer) {
               if (err) {
                   res.status(400).json({ success: false, err: err });
               }
               else if (!isStrongPassword(req.body.password)) {
                    return res.status(400).json({
                    success: false,
                    msg: "Password must have at least 8 characters with uppercase, lowercase, number, and special character."
                    });
                }
               else {
                   let msgStr = `Customer (${req.body.email}) account has been created.`;
                   res.status(201).json({ success: true, message: msgStr });
                   console.log(msgStr);
               }
           });
       }
   });
});

// please fill in the blanks
// see javascript/login.js for ajax call
// see Figure 9.3.5: Node.js project uses token-based authentication and password hashing with bcryptjs on zybooks

router.post("/logIn", function (req, res) {
   if (!req.body.email || !req.body.password) {
       res.status(401).json({ error: "Missing email and/or password" });
       return;
   }
   // Get user from the database
   Customer.findOne({ email: req.body.email }, function (err, customer) {
       if (err) {
           res.status(400).send(err);
       }
       else if (!customer) {
           // Username not in the database
           res.status(401).json({ error: "Login failure!!" });
       }
       else {
           if (bcrypt.compareSync(req.body.password, customer.passwordHash)) {
               const token = jwt.encode({ email: customer.email }, secret);
               //update user's last access time
               customer.lastAccess = new Date();
               customer.save((err, customer) => {
                   console.log("User's LastAccess has been update.");
               });
               // Send back a token that contains the user's username
               res.status(201).json({ success: true, token: token, msg: "Login success" });
           }
           else {
               res.status(401).json({ success: false, msg: "Email or password invalid." });
           }
       }
   });
});

// please fiil in the blanks
// see javascript/account.js for ajax call
// see Figure 9.3.5: Node.js project uses token-based authentication and password hashing with bcryptjs on zybooks

router.get("/status", function (req, res) {
   // See if the X-Auth header is set
   if (!req.headers["x-auth"]) {
       return res.status(401).json({ success: false, msg: "Missing X-Auth header" });
   }
   // X-Auth should contain the token 
   const token = req.headers["x-auth"];
   try {
       const decoded = jwt.decode(token, secret);
       // Send back email and last access
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
       res.status(401).json({ success: false, message: "Invalid JWT" });
   }
});

// Measurement Schedule
router.get("/settings", auth, async (req, res) => {
  try {
    const me = await Customer.findOne({ email: req.user.email }).select("freqMins");
    if (!me) return res.status(404).json({ error: "User not found" });

    return res.json({
      freqMins: Number.isFinite(me.freqMins) ? me.freqMins : 30
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.put("/settings", auth, async (req, res) => {
  try {
    const f = parseInt(req.body?.freqMins, 10);
    if (!Number.isFinite(f) || f < 1 || f > 1440) {
      return res.status(400).json({ error: "freqMins must be between 1 and 1440" });
    }

    const me = await Customer.findOne({ email: req.user.email });
    if (!me) return res.status(404).json({ error: "User not found" });

    me.freqMins = f;
    await me.save();

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// check latest reading for this user (for asking user to take reading every 30 minutes)
router.get("/latest", auth, async (req, res) => {
  const Customer = require("../models/customer");
  const me = await Customer.findOne({ email: req.user.email });
  const devs = await Device.find({ ownerId: me._id }).select("_id");
  const ids = devs.map(d => d._id);

  const last = await Reading.findOne({ deviceId: { $in: ids } })
    .sort({ ts: -1 })
    .select("ts hr spo2");

  res.json(last || null);
});

module.exports = router;