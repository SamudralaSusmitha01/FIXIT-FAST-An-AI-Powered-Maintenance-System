const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  requestId:  { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceRequest' },
  rating:     { type: Number, min: 1, max: 5, required: true },
  comment:    String,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt:  { type: Date, default: Date.now },
}, { _id: false });

const vendorSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true },
  phone:         { type: String, required: true },
  licenseNumber: { type: String, default: null },
  serviceArea:   { type: String, default: null },
  avatar:        { type: String, default: null },

  specialties: [{
    type: String,
    enum: ['plumbing','electrical','hvac','structural','appliance','general','other'],
  }],

  // Performance stats (updated on each completed job)
  stats: {
    totalJobs:        { type: Number, default: 0 },
    completedJobs:    { type: Number, default: 0 },
    avgRating:        { type: Number, default: 0, min: 0, max: 5 },
    avgResponseTime:  { type: Number, default: 0 },  // in minutes
    satisfactionRate: { type: Number, default: 0 },  // 0-100
  },

  reviews:  [reviewSchema],
  isActive: { type: Boolean, default: true },

  // Rate info
  hourlyRate: { type: Number, default: null },
  currency:   { type: String, default: 'USD' },

}, { timestamps: true });

// Recalculate stats after a review is added
vendorSchema.methods.recalculateStats = function () {
  if (this.reviews.length === 0) return;
  const total = this.reviews.reduce((s, r) => s + r.rating, 0);
  this.stats.avgRating = parseFloat((total / this.reviews.length).toFixed(2));
  this.stats.satisfactionRate = Math.round(
    (this.reviews.filter(r => r.rating >= 4).length / this.reviews.length) * 100
  );
};

module.exports = mongoose.model('Vendor', vendorSchema);
