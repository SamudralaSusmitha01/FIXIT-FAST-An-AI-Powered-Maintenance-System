const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  skip: (req) => req.path === '/health',
});

// Stricter limiter for AI endpoints (costs money per call)
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, message: 'AI diagnosis limit reached. Try again in an hour.' },
});

module.exports = rateLimiter;
module.exports.aiRateLimiter = aiRateLimiter;
