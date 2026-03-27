const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const Property = require('../models/Property');
const { generateInsights } = require('../services/aiService');

router.use(authenticate, authorize('landlord'));

// GET /api/analytics/overview — dashboard KPIs
router.get('/overview', async (req, res) => {
  const properties = await Property.find({ landlordId: req.user._id }).select('_id');
  const propertyIds = properties.map(p => p._id);

  const [
    total, open, inProgress, completed, urgent,
    avgCostResult, avgResponseResult
  ] = await Promise.all([
    MaintenanceRequest.countDocuments({ propertyId: { $in: propertyIds } }),
    MaintenanceRequest.countDocuments({ propertyId: { $in: propertyIds }, status: 'open' }),
    MaintenanceRequest.countDocuments({ propertyId: { $in: propertyIds }, status: 'in-progress' }),
    MaintenanceRequest.countDocuments({ propertyId: { $in: propertyIds }, status: 'completed' }),
    MaintenanceRequest.countDocuments({ propertyId: { $in: propertyIds }, priority: 'high', status: { $in: ['open','in-progress'] } }),
    MaintenanceRequest.aggregate([
      { $match: { propertyId: { $in: propertyIds }, status: 'completed', actualCost: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$actualCost' } } }
    ]),
    MaintenanceRequest.aggregate([
      { $match: { propertyId: { $in: propertyIds }, status: 'completed', completedAt: { $ne: null } } },
      { $project: { responseHours: { $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 3600000] } } },
      { $group: { _id: null, avg: { $avg: '$responseHours' } } }
    ])
  ]);

  const resolutionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  res.json({
    success: true,
    overview: {
      total, open, inProgress, completed, urgent, resolutionRate,
      avgCost:         Math.round(avgCostResult[0]?.avg || 0),
      avgResponseHours: parseFloat((avgResponseResult[0]?.avg || 0).toFixed(1)),
    }
  });
});

// GET /api/analytics/by-category — breakdown by issue category
router.get('/by-category', async (req, res) => {
  const properties = await Property.find({ landlordId: req.user._id }).select('_id');
  const propertyIds = properties.map(p => p._id);

  const data = await MaintenanceRequest.aggregate([
    { $match: { propertyId: { $in: propertyIds } } },
    { $group: { _id: '$category', count: { $sum: 1 }, avgCost: { $avg: '$actualCost' } } },
    { $sort: { count: -1 } }
  ]);

  res.json({ success: true, categories: data });
});

// GET /api/analytics/by-month — monthly trend (last 6 months)
router.get('/by-month', async (req, res) => {
  const properties = await Property.find({ landlordId: req.user._id }).select('_id');
  const propertyIds = properties.map(p => p._id);
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const data = await MaintenanceRequest.aggregate([
    { $match: { propertyId: { $in: propertyIds }, createdAt: { $gte: sixMonthsAgo } } },
    { $group: {
      _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
      count: { $sum: 1 },
      totalCost: { $sum: '$actualCost' }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  res.json({ success: true, monthly: data });
});

// GET /api/analytics/vendors — vendor performance stats
router.get('/vendors', async (req, res) => {
  const properties = await Property.find({ landlordId: req.user._id }).select('_id');
  const propertyIds = properties.map(p => p._id);

  const data = await MaintenanceRequest.aggregate([
    { $match: { propertyId: { $in: propertyIds }, vendorId: { $ne: null }, status: 'completed' } },
    { $lookup: { from: 'vendors', localField: 'vendorId', foreignField: '_id', as: 'vendor' } },
    { $unwind: '$vendor' },
    { $group: {
      _id: '$vendorId',
      name:         { $first: '$vendor.name' },
      jobs:         { $sum: 1 },
      avgRating:    { $avg: '$tenantRating' },
      totalRevenue: { $sum: '$actualCost' }
    }},
    { $sort: { jobs: -1 } }
  ]);

  res.json({ success: true, vendors: data });
});

// GET /api/analytics/insights — AI-generated insights
router.get('/insights', async (req, res) => {
  const properties = await Property.find({ landlordId: req.user._id }).select('_id');
  const propertyIds = properties.map(p => p._id);

  const recentRequests = await MaintenanceRequest.find({ propertyId: { $in: propertyIds } })
    .sort('-createdAt').limit(50).select('category title status priority actualCost');

  if (recentRequests.length < 3) {
    return res.json({ success: true, insights: [] });
  }

  const insights = await generateInsights(recentRequests);
  res.json({ success: true, insights });
});

module.exports = router;
