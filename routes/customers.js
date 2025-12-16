var express = require('express');
var router = express.Router();
var Customer = require("../models/customer");
const jwt = require("jwt-simple");
const bcrypt = require("bcryptjs");
const fs = require('fs');

const secret = fs.readFileSync(__dirname + '/../keys/jwtkey').toString();

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
// GET /customers/settings  -> { startTime, endTime, freqMins }
router.get("/settings", auth, async (req, res) => {
  try {
    const me = await Customer.findOne({ email: req.user.email })
      .select("startTime endTime freqMins");

    if (!me) return res.status(404).json({ error: "User not found" });

    return res.json({
      startTime: me.startTime || "06:00",
      endTime: me.endTime || "22:00",
      freqMins: Number.isFinite(me.freqMins) ? me.freqMins : 30
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// PUT /customers/settings  body: { startTime, endTime, freqMins }
router.put("/settings", auth, async (req, res) => {
  try {
    const { startTime, endTime, freqMins } = req.body || {};

    const hhmm = /^\d{2}:\d{2}$/;
    if (!hhmm.test(String(startTime)) || !hhmm.test(String(endTime))) {
      return res.status(400).json({ error: "startTime/endTime must be HH:MM" });
    }

    const f = parseInt(freqMins, 10);
    if (!Number.isFinite(f) || f < 1 || f > 1440) {
      return res.status(400).json({ error: "freqMins must be between 1 and 1440" });
    }

    const me = await Customer.findOne({ email: req.user.email });
    if (!me) return res.status(404).json({ error: "User not found" });

    me.startTime = startTime;
    me.endTime = endTime;
    me.freqMins = f;
    await me.save();

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;