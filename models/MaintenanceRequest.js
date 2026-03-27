const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  url:          String,
  publicId:     String,
  resourceType: { type: String, enum: ['image', 'video'], default: 'image' },
  uploadedAt:   { type: Date, default: Date.now },
}, { _id: false });

const aiDiagnosisSchema = new mongoose.Schema({
  severity:     { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  summary:      String,
  recommendation: String,
  estimatedCost: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'USD' },
  },
  estimatedTime:  String,   // e.g. "2-3 hours"
  confidence:     Number,   // 0-100
  suggestedCategory: String,
  safetyRisk:     Boolean,
  analyzedAt:     { type: Date, default: Date.now },
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status:    String,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note:      String,
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const maintenanceRequestSchema = new mongoose.Schema({
  // Relations
  tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  landlordId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  propertyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  vendorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },

  // Core fields
  title:       { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, required: true, maxlength: 2000 },
  unit:        { type: String, required: true },
  location:    { type: String },             // e.g. "Bathroom", "Kitchen"

  category: {
    type: String,
    enum: ['plumbing','electrical','hvac','structural','appliance','other'],
    required: true,
  },

  priority: {
    type: String,
    enum: ['low','medium','high'],
    required: true,
    index: true,
  },

  status: {
    type: String,
    enum: ['open','in-progress','completed','declined','on-hold'],
    default: 'open',
    index: true,
  },

  // AI Analysis
  aiDiagnosis:    { type: aiDiagnosisSchema, default: null },
  aiDiagnosisRaw: { type: String, default: null }, // raw GPT response

  // Media
  media: [mediaSchema],

  // Financials
  budget:      { type: Number, default: null },      // Approved budget
  actualCost:  { type: Number, default: null },      // Final cost

  // Scheduling
  scheduledAt:  { type: Date, default: null },
  completedAt:  { type: Date, default: null },

  // Landlord notes
  landlordNotes: { type: String, maxlength: 1000, default: '' },

  // History
  statusHistory: [statusHistorySchema],

  // Tenant rating after completion
  tenantRating:  { type: Number, min: 1, max: 5, default: null },
  tenantFeedback:{ type: String, maxlength: 500, default: '' },

}, { timestamps: true });

// Auto-number for readable IDs
maintenanceRequestSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('MaintenanceRequest').countDocuments();
    this._readableId = `REQ-${String(count + 1001).padStart(4, '0')}`;
  }
  next();
});

maintenanceRequestSchema.virtual('readableId').get(function () {
  return this._readableId || `REQ-${this._id.toString().slice(-6).toUpperCase()}`;
});

maintenanceRequestSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
