// routes/properties.js
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const Property = require('../models/Property');
const User = require('../models/User');

router.use(authenticate);

// GET /api/properties
router.get('/', authorize('landlord'), async (req, res) => {
  try {
    const properties = await Property.find({ landlordId: req.user._id, isActive: true })
      .populate('tenants.userId', 'name email unit');

    const formatted = properties.map(p => {
      const obj = p.toObject();
      obj.tenants = (obj.tenants || []).map(t => {
        const user = t.userId;
        return {
          _id:   user?._id   || t.userId,
          name:  user?.name  || t.name  || t.email || 'Tenant',
          email: user?.email || t.email || '',
          unit:  t.unit || '',
        };
      });
      return obj;
    });

    res.json({ success: true, properties: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/properties — create property
router.post('/', authorize('landlord'), async (req, res) => {
  try {
    const property = await Property.create({ ...req.body, landlordId: req.user._id });
    req.user.properties = req.user.properties || [];
    req.user.properties.push(property._id);
    await req.user.save();
    res.status(201).json({ success: true, property });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/properties/:id
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('tenants.userId', 'name email phone');
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
    res.json({ success: true, property });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/properties/:id
router.patch('/:id', authorize('landlord'), async (req, res) => {
  try {
    const property = await Property.findOneAndUpdate(
      { _id: req.params.id, landlordId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
    res.json({ success: true, property });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/properties/:id — soft delete, unlinks all tenants
router.delete('/:id', authorize('landlord'), async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found or access denied' });
    }

    // Unlink all tenants
    const tenantIds = (property.tenants || []).map(t => t.userId).filter(Boolean);
    if (tenantIds.length > 0) {
      await User.updateMany(
        { _id: { $in: tenantIds } },
        { $unset: { propertyId: '', unit: '' } }
      );
    }

    // Remove from landlord's list
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { properties: property._id }
    });

    // Soft delete
    property.isActive = false;
    property.tenants  = [];
    await property.save();

    res.json({ success: true, message: `Property "${property.name}" deleted` });
  } catch (err) {
    console.error('delete property error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/properties/:id/assign-tenant
router.post('/:id/assign-tenant', authorize('landlord'), async (req, res) => {
  try {
    const { email, unit } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const property = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    const tenant = await User.findOne({ email: email.toLowerCase().trim() });
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: `No user found with email "${email}". Make sure the tenant has registered first.`,
      });
    }

    // ✅ Prevent landlord from assigning themselves as a tenant
    if (tenant._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: `You cannot assign yourself as a tenant. Please use a different account for the tenant.`,
      });
    }

    const alreadyIn = (property.tenants || []).some(
      t => t.userId?.toString() === tenant._id.toString()
    );
    if (!alreadyIn) {
      property.tenants.push({
        userId: tenant._id,
        unit:   unit || 'Unit 1A',
        name:   tenant.name,
        email:  tenant.email,
      });
      await property.save();
    } else {
      // Update name/email/unit even if already assigned
      const idx = property.tenants.findIndex(t => t.userId?.toString() === tenant._id.toString());
      if (idx !== -1) {
        if (unit) property.tenants[idx].unit = unit;
        property.tenants[idx].name  = tenant.name;
        property.tenants[idx].email = tenant.email;
        await property.save();
      }
    }

    // Only update role to 'tenant' if they aren't already a landlord
    const updateFields = {
      propertyId: property._id,
      unit: unit || tenant.unit || 'Unit 1A',
    };
    if (tenant.role !== 'landlord') {
      updateFields.role = 'tenant';
    }
    await User.findByIdAndUpdate(tenant._id, updateFields);

    res.json({
      success:  true,
      message:  `${tenant.name || email} has been assigned to ${property.name}`,
      tenant:   { _id: tenant._id, name: tenant.name, email: tenant.email, unit },
      property: { _id: property._id, name: property.name },
    });
  } catch (err) {
    console.error('assign-tenant error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/properties/:id/remove-tenant
router.post('/:id/remove-tenant', authorize('landlord'), async (req, res) => {
  try {
    const { tenantId, email } = req.body;
    const property = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    let resolvedId = tenantId;
    if (!resolvedId && email) {
      const u = await User.findOne({ email: email.toLowerCase().trim() });
      if (u) resolvedId = u._id.toString();
    }
    if (!resolvedId) return res.status(400).json({ success: false, message: 'tenantId or email required' });

    const before = property.tenants.length;
    property.tenants = property.tenants.filter(
      t => t.userId?.toString() !== resolvedId.toString() &&
           t._id?.toString()    !== resolvedId.toString()
    );
    if (property.tenants.length === before) {
      return res.status(404).json({ success: false, message: 'Tenant not found in this property' });
    }
    await property.save();

    await User.findByIdAndUpdate(resolvedId, { $unset: { propertyId: '', unit: '' } }).catch(() => {});

    res.json({ success: true, message: 'Tenant removed from property' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/properties/:id/tenants/:tenantId
router.delete('/:id/tenants/:tenantId', authorize('landlord'), async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    property.tenants = property.tenants.filter(
      t => t.userId?.toString() !== req.params.tenantId &&
           t._id?.toString()    !== req.params.tenantId
    );
    await property.save();

    await User.findByIdAndUpdate(req.params.tenantId, { $unset: { propertyId: '', unit: '' } }).catch(() => {});

    res.json({ success: true, message: 'Tenant removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/properties/:id/tenants (legacy)
router.post('/:id/tenants', authorize('landlord'), async (req, res) => {
  try {
    const { userId, unit, email } = req.body;
    const property = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    let tenantId = userId;
    let tenantDoc = null;
    if (!tenantId && email) {
      tenantDoc = await User.findOne({ email: email.toLowerCase().trim() });
      if (!tenantDoc) return res.status(404).json({ success: false, message: `No user found with email "${email}"` });
      tenantId = tenantDoc._id;
    }

    const alreadyIn = (property.tenants || []).some(t => t.userId?.toString() === tenantId?.toString());
    if (!alreadyIn && tenantId) {
      if (!tenantDoc) tenantDoc = await User.findById(tenantId);
      property.tenants.push({ userId: tenantId, unit: unit || 'Unit 1A', name: tenantDoc?.name || '', email: tenantDoc?.email || '' });
      await property.save();
    }
    if (tenantId) {
      await User.findByIdAndUpdate(tenantId, { propertyId: property._id, unit: unit || 'Unit 1A' });
    }

    const updated = await Property.findById(property._id).populate('tenants.userId', 'name email');
    res.json({ success: true, property: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;