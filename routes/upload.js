const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const MaintenanceRequest = require('../models/MaintenanceRequest');

router.use(authenticate);

// POST /api/upload/request/:requestId  — upload photos/videos to a request
router.post('/request/:requestId', upload.array('media', 5), async (req, res) => {
  const request = await MaintenanceRequest.findById(req.params.requestId);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  // Only the tenant who owns the request can upload
  if (request.tenantId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded' });
  }

  const newMedia = req.files.map(file => ({
    url:          file.path,
    publicId:     file.filename,
    resourceType: file.mimetype.startsWith('video/') ? 'video' : 'image',
  }));

  request.media.push(...newMedia);
  await request.save();

  res.json({
    success: true,
    message: `${req.files.length} file(s) uploaded`,
    media: newMedia,
  });
});

// Users routes
module.exports = router;
