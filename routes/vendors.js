const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const Vendor = require('../models/Vendor');

router.use(authenticate);

// GET /api/vendors — list vendors, optionally filter by specialty
router.get('/', async (req, res) => {
  const { specialty, minRating, sort = '-stats.satisfactionRate' } = req.query;
  const filter = { isActive: true };
  if (specialty) filter.specialties = specialty;
  if (minRating)  filter['stats.avgRating'] = { $gte: Number(minRating) };

  const vendors = await Vendor.find(filter).sort(sort).limit(50);
  res.json({ success: true, vendors });
});

// POST /api/vendors — landlord adds a vendor
router.post('/', authorize('landlord'), validate(schemas.createVendor), async (req, res) => {
  const vendor = await Vendor.create(req.body);
  res.status(201).json({ success: true, vendor });
});

// GET /api/vendors/:id
router.get('/:id', async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
  res.json({ success: true, vendor });
});

// PATCH /api/vendors/:id
router.patch('/:id', authorize('landlord'), async (req, res) => {
  const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
  res.json({ success: true, vendor });
});

// DELETE /api/vendors/:id — soft delete
router.delete('/:id', authorize('landlord'), async (req, res) => {
  await Vendor.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true, message: 'Vendor deactivated' });
});

module.exports = router;
