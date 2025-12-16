// routes/index.js
// Default route for the app (usually mounted at "/")

var express = require('express');
var router = express.Router(); // Create a router instance for grouping routes

/* GET home page. */
router.get('/', function (req, res, next) {
  // Render the "index" view (e.g., views/index.pug or index.ejs depending on your setup)
  // Pass template variables into the view; here we pass { title: "Express" }
  res.render('index', { title: 'Express' });
});

module.exports = router; // Export router so app.js can mount it (e.g., app.use('/', router))