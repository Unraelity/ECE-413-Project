// app.js
// Main Express application setup: middleware, routes, static files, and error handling.

require("dotenv").config(); // Loads environment variables from .env into process.env

var createError = require('http-errors'); // Utility for generating HTTP errors (e.g., 404)
var express = require('express');         // Express web framework
var path = require('path');               // Path utilities for filesystem paths
var cookieParser = require('cookie-parser'); // Parses Cookie header into req.cookies
var logger = require('morgan');           // HTTP request logger middleware

const bodyParser = require('body-parser'); // Parses request bodies (JSON + urlencoded)

// Routers (route modules) — these define endpoints for different parts of the app
var indexRouter = require('./routes/index');
var customersRouter = require('./routes/customers');
var devicesRouter = require('./routes/devices');
var readingsRouter = require('./routes/readings');
var aiRouter = require('./routes/ai');

var app = express(); // Create the Express app instance

// ==========================================================
// View engine setup (server-rendered views)
// ==========================================================
app.set('views', path.join(__dirname, 'views')); // Folder where view templates live
app.set('view engine', 'jade');                  // Use Jade (now commonly called Pug)

// ==========================================================
// CORS setup (Cross-Origin Resource Sharing)
// Allows other origins to call your API endpoints.
// ==========================================================
app.use(function (req, res, next) {
  // Allow any website (any origin) to access this server
  // NOTE: In production, you usually restrict this to your real domain.
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Allowed HTTP methods
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

  // Allowed headers browsers may send
  // NOTE: Your app uses "x-auth" and "x-integration-key" headers elsewhere,
  // but they are NOT listed here. If you make cross-origin requests with those
  // headers, the browser preflight may fail unless you add them.
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Whether the browser is allowed to include cookies/credentials in cross-site requests
  // NOTE: If Access-Control-Allow-Origin is '*', browsers will not allow credentials anyway.
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Continue to the next middleware
  next();
});

// ==========================================================
// Body parsing middleware
// ==========================================================

// Parse application/json into req.body
app.use(bodyParser.json());

// Parse application/x-www-form-urlencoded (form posts) into req.body
app.use(bodyParser.urlencoded({ extended: true }));

// NOTE: express.json() and express.urlencoded() below do similar things.
app.use(logger('dev')); // Log requests to the console (method, path, status, response time)

// Built-in Express body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cookieParser()); // Parse cookies into req.cookies

// Serve static files from /public (HTML, CSS, client JS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================================
// Route mounting
// ==========================================================

// Mount routers at specific base paths:
app.use('/', indexRouter);              // GET / (render index view)
app.use('/customers', customersRouter); // /customers/signUp, /customers/logIn, /customers/settings, etc.
app.use('/devices', devicesRouter);     // /devices CRUD
app.use('/readings', readingsRouter);   // /readings webhook + daily + weekly summary
app.use('/ai', aiRouter);               // /ai/ask (AI assistant)

// ==========================================================
// 404 handler (no route matched)
// ==========================================================
app.use(function (req, res, next) {
  // Forward a 404 error to the error handler
  next(createError(404));
});

// ==========================================================
// Error handler (handles 404 and any other thrown errors)
// ==========================================================
app.use(function (err, req, res, next) {
  // Set locals for the view template
  res.locals.message = err.message;

  // In development, show full error details; in production, hide stack traces
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Set response status (use err.status if available)
  res.status(err.status || 500);

  // Render the error page (views/error.jade)
  res.render('error');
});

// app.listen(3000);

// Export the app so it can be started by bin/www or another entrypoint
module.exports = app;