/**
 * In-memory Rate Limiter Middleware
 *
 * Uses a sliding window log strategy per IP.
 * No external dependencies — pure Node.js Map + timestamps.
 */

const store = new Map(); // ip -> [timestamps]

/**
 * Periodically cleans up expired entries to prevent memory bloat.
 */
function startCleanup(windowMs, intervalMs = 60_000) {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of store.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        store.delete(ip);
      } else {
        store.set(ip, valid);
      }
    }
  }, intervalMs);
}

/**
 * Creates a rate limiter middleware.
 *
 * @param {Object} options
 * @param {number} options.windowMs       - Time window in ms (default: 60_000 = 1 min)
 * @param {number} options.max            - Max requests per window (default: 10)
 * @param {string} [options.message]      - Custom error message
 * @param {boolean} [options.headers]     - Send rate-limit headers (default: true)
 * @param {Function} [options.keyGen]     - Custom key generator fn(req) -> string
 * @param {Function} [options.onLimitReached] - Hook called when limit is hit
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60_000,
    max = 10,
    message = "Too many requests. Please try again later.",
    headers = true,
    keyGen = (req) =>
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.socket.remoteAddress,
    onLimitReached = null,
  } = options;

  // Start background cleanup
  startCleanup(windowMs);

  return function rateLimiterMiddleware(req, res, next) {
    const key = keyGen(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing timestamps and filter to current window (sliding window)
    const timestamps = (store.get(key) || []).filter((t) => t > windowStart);

    const requestCount = timestamps.length;
    const remaining = Math.max(0, max - requestCount);
    const resetTime = timestamps.length > 0 ? timestamps[0] + windowMs : now + windowMs;

    if (headers) {
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, remaining - 1));
      res.setHeader("X-RateLimit-Reset", Math.ceil(resetTime / 1000));
      res.setHeader("X-RateLimit-Window-Ms", windowMs);
    }

    if (requestCount >= max) {
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      if (headers) {
        res.setHeader("Retry-After", retryAfter);
      }

      if (typeof onLimitReached === "function") {
        onLimitReached(req, res);
      }

      return res.status(429).json({
        success: false,
        error: "RATE_LIMIT_EXCEEDED",
        message,
        retryAfter,
      });
    }

    // Record this request
    timestamps.push(now);
    store.set(key, timestamps);

    next();
  };
}

// Expose store for stats endpoint
function getStoreSnapshot() {
  const snapshot = {};
  for (const [ip, timestamps] of store.entries()) {
    snapshot[ip] = timestamps.length;
  }
  return snapshot;
}

module.exports = { createRateLimiter, getStoreSnapshot };
