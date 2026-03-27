const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/requestController');

// All routes require authentication
router.use(authenticate);

// ── Tenant: submit & view own requests ──────────────────────────────────
// POST /api/requests
router.post('/', validate(schemas.createRequest), ctrl.createRequest);

// GET /api/requests  (tenant sees own, landlord sees all their properties)
router.get('/', ctrl.getRequests);

// GET /api/requests/:id
router.get('/:id', ctrl.getRequestById);

// POST /api/requests/:id/diagnose  — trigger AI diagnosis
router.post('/:id/diagnose', aiRateLimiter, ctrl.diagnoseRequest);

// ── Landlord: manage requests ───────────────────────────────────────────
// PATCH /api/requests/:id  — update status, assign vendor, add notes
router.patch('/:id', authorize('landlord'), validate(schemas.updateRequest), ctrl.updateRequest);

// POST /api/requests/:id/approve
router.post('/:id/approve', authorize('landlord'), ctrl.approveRequest);

// POST /api/requests/:id/decline
router.post('/:id/decline', authorize('landlord'), ctrl.declineRequest);

// ── Tenant: rate completed request ──────────────────────────────────────
// POST /api/requests/:id/rate
router.post('/:id/rate', authorize('tenant'), ctrl.rateRequest);

module.exports = router;
