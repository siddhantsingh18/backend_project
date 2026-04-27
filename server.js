const express = require("express");
const logger = require("./src/middleware/logger");
const routes = require("./src/routes/index");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Trust proxy headers (for real IPs behind load balancers/Nginx)
app.set("trust proxy", 1);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/", routes);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("[ERROR]", err.stack);
  res.status(500).json({ success: false, error: "Internal server error." });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\x1b[36m🚀 Rate Limiter API running on http://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[90m   Health check: GET /health\x1b[0m`);
  console.log(`\x1b[90m   Data API:     GET /api/data       (30 req/min)\x1b[0m`);
  console.log(`\x1b[90m   Auth API:     POST /api/auth/login (5 req/15min)\x1b[0m`);
  console.log(`\x1b[90m   Search API:   GET /api/search?q=  (10 req/30sec)\x1b[0m`);
  console.log(`\x1b[90m   Stats:        GET /api/admin/rate-limit-stats\x1b[0m`);
});

module.exports = app;
