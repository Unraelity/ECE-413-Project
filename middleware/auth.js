const jwt = require("jwt-simple"); // Lightweight library for encoding/decoding JWTs
const fs = require("fs");          // Node's file system module (used to read the secret key)

// Read the JWT secret key from a file on disk.
// __dirname is the directory of this file; "/../keys/jwtkey" goes up one level into /keys.
// .toString() converts the file Buffer into a normal string secret.
const secret = fs.readFileSync(__dirname + "/../keys/jwtkey").toString();

// Export an Express middleware function (req, res, next)
module.exports = function auth(req, res, next) {
  // Expect the client to send the JWT in a custom header: X-Auth
  // In Node/Express, header names are normalized to lowercase keys.
  const token = req.headers["x-auth"];

  // If no token is present, reject the request as unauthorized (401)
  // Returning here prevents the rest of the middleware from running.
  if (!token) return res.status(401).json({ error: "Missing X-Auth header" }); // 401 per spec

  try {
    // Decode the JWT using the shared secret.
    // If decoding succeeds, attach the decoded payload to req.user
    // so downstream routes can use it (e.g., req.user.id, req.user.email).
    req.user = jwt.decode(token, secret);

    // Debug log: helpful during development; consider removing or guarding in production.
    console.log("AUTH — decoded JWT:", req.user);

    // Allow the request to continue to the next middleware/route handler.
    next();
  } catch {
    // If decode throws (bad token, wrong secret, malformed JWT), treat as unauthorized.
    return res.status(401).json({ error: "Invalid JWT" });
  }
};
