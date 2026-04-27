/**
 * Simple request logger middleware
 */
function logger(req, res, next) {
  const start = Date.now();
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket.remoteAddress;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color =
      status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : "\x1b[32m";
    console.log(
      `${color}[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${status} - ${duration}ms  IP: ${ip}\x1b[0m`
    );
  });

  next();
}

module.exports = logger;
