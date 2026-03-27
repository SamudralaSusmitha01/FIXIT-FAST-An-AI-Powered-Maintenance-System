const MaintenanceRequest = require('../models/MaintenanceRequest');
const Property = require('../models/Property');
const Vendor = require('../models/Vendor');
const { diagnoseMaintenance } = require('../services/aiService');
const { notifyNewRequest, notifyStatusChange, notifyVendorAssigned } = require('../services/notificationService');

// ── CREATE REQUEST ─────────────────────────────────────────────────────
async function createRequest(req, res) {
  const { title, description, category, priority, location, propertyId, unit } = req.body;
  const io = req.app.get('io');

  // Verify property exists and tenant belongs to it
  const property = await Property.findById(propertyId);
  if (!property) {
    return res.status(404).json({ success: false, message: 'Property not found' });
  }

  const request = await MaintenanceRequest.create({
    title, description, category, priority, location, unit,
    propertyId,
    tenantId:   req.user._id,
    landlordId: property.landlordId,
    statusHistory: [{
      status:    'open',
      changedBy: req.user._id,
      note:      'Request submitted by tenant',
    }],
  });

  // Real-time alert to landlord
  notifyNewRequest(io, property.landlordId.toString(), request);

  const populated = await MaintenanceRequest.findById(request._id)
    .populate('tenantId', 'name email unit')
    .populate('propertyId', 'name address');

  res.status(201).json({ success: true, request: populated });
}

// ── GET REQUESTS ───────────────────────────────────────────────────────
async function getRequests(req, res) {
  const { status, priority, category, page = 1, limit = 20, sort = '-createdAt' } = req.query;

  const filter = {};

  if (req.user.role === 'tenant') {
    filter.tenantId = req.user._id;
  } else if (req.user.role === 'landlord') {
    // Get all properties this landlord owns
    const properties = await Property.find({ landlordId: req.user._id }).select('_id');
    filter.propertyId = { $in: properties.map(p => p._id) };
  }

  if (status)   filter.status = status;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;

  const skip = (Number(page) - 1) * Number(limit);

  const [requests, total] = await Promise.all([
    MaintenanceRequest.find(filter)
      .populate('tenantId', 'name email unit avatar')
      .populate('propertyId', 'name address city')
      .populate('vendorId', 'name phone stats.avgRating')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
    MaintenanceRequest.countDocuments(filter),
  ]);

  res.json({
    success: true,
    requests,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      limit: Number(limit),
    },
  });
}

// ── GET BY ID ──────────────────────────────────────────────────────────
async function getRequestById(req, res) {
  const request = await MaintenanceRequest.findById(req.params.id)
    .populate('tenantId', 'name email phone unit avatar')
    .populate('propertyId', 'name address city state')
    .populate('vendorId', 'name phone email stats specialties')
    .populate('statusHistory.changedBy', 'name role');

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  // Authorization: tenant can only see own requests; landlord can see their properties'
  const isOwner = request.tenantId._id.toString() === req.user._id.toString();
  const isLandlord = req.user.role === 'landlord' &&
    request.landlordId.toString() === req.user._id.toString();

  if (!isOwner && !isLandlord && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  res.json({ success: true, request });
}

// ── AI DIAGNOSIS ───────────────────────────────────────────────────────
async function diagnoseRequest(req, res) {
  const request = await MaintenanceRequest.findById(req.params.id);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  // Only the tenant who created it can trigger diagnosis
  if (request.tenantId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const mediaUrls = request.media.map(m => m.url);

  const diagnosis = await diagnoseMaintenance({
    title:       request.title,
    description: request.description,
    category:    request.category,
    location:    request.location,
    mediaUrls,
  });

  request.aiDiagnosis = diagnosis;
  await request.save();

  res.json({ success: true, diagnosis });
}

// ── UPDATE REQUEST (Landlord) ──────────────────────────────────────────
async function updateRequest(req, res) {
  const { status, vendorId, notes, budget } = req.body;
  const io = req.app.get('io');

  const request = await MaintenanceRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  if (request.landlordId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (status && status !== request.status) {
    request.statusHistory.push({ status, changedBy: req.user._id, note: notes || '' });
    request.status = status;
    if (status === 'completed') request.completedAt = new Date();
    notifyStatusChange(io, request);
  }

  if (vendorId) {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    request.vendorId = vendorId;
    notifyVendorAssigned(io, request, vendor);
  }

  if (notes !== undefined) request.landlordNotes = notes;
  if (budget !== undefined) request.budget = budget;

  await request.save();

  const updated = await MaintenanceRequest.findById(request._id)
    .populate('tenantId', 'name email')
    .populate('vendorId', 'name phone stats');

  res.json({ success: true, request: updated });
}

// ── APPROVE REQUEST ────────────────────────────────────────────────────
async function approveRequest(req, res) {
  const { vendorId, budget } = req.body;
  const io = req.app.get('io');

  const request = await MaintenanceRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  if (request.landlordId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  request.status = 'in-progress';
  request.statusHistory.push({ status: 'in-progress', changedBy: req.user._id, note: 'Approved by landlord' });

  if (vendorId) {
    const vendor = await Vendor.findById(vendorId);
    if (vendor) {
      request.vendorId = vendorId;
      notifyVendorAssigned(io, request, vendor);
    }
  }
  if (budget) request.budget = budget;

  await request.save();
  notifyStatusChange(io, request);

  res.json({ success: true, message: 'Request approved', request });
}

// ── DECLINE REQUEST ────────────────────────────────────────────────────
async function declineRequest(req, res) {
  const io = req.app.get('io');
  const { reason } = req.body;

  const request = await MaintenanceRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  if (request.landlordId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  request.status = 'declined';
  request.statusHistory.push({ status: 'declined', changedBy: req.user._id, note: reason || 'Declined by landlord' });
  await request.save();

  notifyStatusChange(io, request);
  res.json({ success: true, message: 'Request declined' });
}

// ── RATE REQUEST ───────────────────────────────────────────────────────
async function rateRequest(req, res) {
  const { rating, feedback } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be 1-5' });
  }

  const request = await MaintenanceRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
  if (request.tenantId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  if (request.status !== 'completed') {
    return res.status(400).json({ success: false, message: 'Can only rate completed requests' });
  }

  request.tenantRating  = rating;
  request.tenantFeedback = feedback || '';
  await request.save();

  // Update vendor stats if a vendor was assigned
  if (request.vendorId) {
    const vendor = await Vendor.findById(request.vendorId);
    if (vendor) {
      vendor.reviews.push({ requestId: request._id, rating, comment: feedback, reviewedBy: req.user._id });
      vendor.recalculateStats();
      await vendor.save();
    }
  }

  res.json({ success: true, message: 'Rating submitted' });
}

module.exports = {
  createRequest,
  getRequests,
  getRequestById,
  diagnoseRequest,
  updateRequest,
  approveRequest,
  declineRequest,
  rateRequest,
};
