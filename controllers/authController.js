const User = require('../models/User');

// GET /api/auth/me  — returns user with populated propertyId so frontend
// can read property name/address directly from currentUserData.propertyId.name
async function getMe(req, res) {
  // Populate propertyId so the tenant sees full property details
  const user = await User.findById(req.user._id).populate('propertyId', 'name address city state zip');
  res.json({ success: true, user: user.toPublicJSON() });
}

// PATCH /api/auth/role
async function updateRole(req, res) {
  const { role } = req.body;
  req.user.role = role;
  await req.user.save();
  const user = await User.findById(req.user._id).populate('propertyId', 'name address city state zip');
  res.json({ success: true, message: `Role updated to ${role}`, user: user.toPublicJSON() });
}

// PATCH /api/auth/profile
async function updateProfile(req, res) {
  const allowed = ['name', 'phone', 'avatar', 'notifications'];
  allowed.forEach(field => {
    if (req.body[field] !== undefined) req.user[field] = req.body[field];
  });
  await req.user.save();
  const user = await User.findById(req.user._id).populate('propertyId', 'name address city state zip');
  res.json({ success: true, user: user.toPublicJSON() });
}

module.exports = { getMe, updateRole, updateProfile };