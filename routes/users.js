const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const User = require('../models/User');

router.use(authenticate);

// GET /api/users/me — alias for /api/auth/me (with populated propertyId)
router.get('/me', async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('propertyId', 'name address city state zip');
  res.json({ success: true, user: user.toPublicJSON() });
});

// PATCH /api/users/me/unit — tenant sets their unit & property
router.patch('/me/unit', async (req, res) => {
  const { propertyId, unit } = req.body;
  req.user.propertyId = propertyId;
  req.user.unit = unit;
  await req.user.save();
  const user = await User.findById(req.user._id)
    .populate('propertyId', 'name address city state zip');
  res.json({ success: true, user: user.toPublicJSON() });
});

// GET /api/users/:id — admin or landlord lookup
router.get('/:id', authorize('landlord', 'admin'), async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-firebaseUid')
    .populate('propertyId', 'name address city state zip');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user: user.toPublicJSON() });
});

module.exports = router;