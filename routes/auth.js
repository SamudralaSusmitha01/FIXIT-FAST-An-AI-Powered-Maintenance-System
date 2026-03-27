const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { getMe, updateRole, updateProfile } = require('../controllers/authController');

// GET  /api/auth/me  — get current user profile
router.get('/me', authenticate, getMe);

// PATCH /api/auth/role — set tenant or landlord role after login
router.patch('/role', authenticate, validate(schemas.updateRole), updateRole);

// PATCH /api/auth/profile — update name, phone, etc.
router.patch('/profile', authenticate, updateProfile);

module.exports = router;
