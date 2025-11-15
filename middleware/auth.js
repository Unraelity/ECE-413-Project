const jwt = require("jwt-simple");
const fs = require("fs");
const secret = fs.readFileSync(__dirname + "/../keys/jwtkey").toString();

module.exports = function auth(req, res, next) {
    const token = req.headers["x-auth"];
    if (!token) return res.status(401).json({ error: "Missing X-Auth header" }); // 401 per spec
    try { req.user = jwt.decode(token, secret); next(); }
    catch { return res.status(401).json({ error: "Invalid JWT" }); }
};