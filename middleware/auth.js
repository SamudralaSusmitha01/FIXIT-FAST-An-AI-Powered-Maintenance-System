const { getAdmin } = require('../config/firebase');
const User = require('../models/User');

// Verify Firebase ID token and attach user to req
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const admin = getAdmin();
    const decoded = await admin.auth().verifyIdToken(token);

    // Find or auto-create user in MongoDB
    let user = await User.findOne({ firebaseUid: decoded.uid });

    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        email: decoded.email,
        name: decoded.name || decoded.email?.split('@')[0],
        avatar: decoded.picture || null,
        role: 'tenant', // default; updated on role selection
      });
    }

    req.user = user;
    req.firebaseUser = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Role-based access guard
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
