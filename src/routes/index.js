const express = require("express");
const { createRateLimiter, getStoreSnapshot } = require("../middleware/rateLimiter");

const router = express.Router();

// ─── Rate Limiter Configs ────────────────────────────────────────────────────

/** General API: 30 req/min */
const generalLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: "Too many requests to the API. Please slow down.",
});

/** Auth routes: strict — 5 req/15 min */
const authLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 5,
  message: "Too many login attempts. Please wait 15 minutes.",
  onLimitReached: (req) => {
    console.warn(`[SECURITY] Auth rate limit hit for IP: ${req.socket.remoteAddress}`);
  },
});

/** Search: 10 req/30 sec (burst-sensitive) */
const searchLimiter = createRateLimiter({
  windowMs: 30_000,
  max: 10,
  message: "Search rate limit exceeded. Please wait a moment.",
});

// ─── Routes ─────────────────────────────────────────────────────────────────

/** Health check — no rate limit */
router.get("/health", (req, res) => {
  res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
});

/** General public API */
router.get("/api/data", generalLimiter, (req, res) => {
  res.json({
    success: true,
    message: "Here is your data.",
    data: { items: ["apple", "banana", "cherry"], timestamp: Date.now() },
  });
});

/** Simulated login — strict limiter */
router.post("/api/auth/login", authLimiter, (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Username and password required." });
  }

  // Simulate auth (not a real auth system)
  if (username === "admin" && password === "password123") {
    return res.json({ success: true, token: "fake-jwt-token-abc123" });
  }

  res.status(401).json({ success: false, error: "Invalid credentials." });
});

/** Search endpoint — burst limiter */
router.get("/api/search", searchLimiter, (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ success: false, error: "Query param `q` is required." });
  }

  // Mock search results
  const results = ["result_1", "result_2", "result_3"].map((r) => ({
    id: r,
    title: `Result for "${q}"`,
  }));

  res.json({ success: true, query: q, results });
});

/** Admin: view current rate limit store */
router.get("/api/admin/rate-limit-stats", (req, res) => {
  const stats = getStoreSnapshot();
  const totalIPs = Object.keys(stats).length;
  res.json({
    success: true,
    totalTrackedIPs: totalIPs,
    breakdown: stats,
  });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────

router.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found." });
});

module.exports = router;
