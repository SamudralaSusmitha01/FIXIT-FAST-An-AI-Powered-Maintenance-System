const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  landlordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  name:    { type: String, required: true, trim: true },
  address: { type: String, required: true },
  city:    { type: String, required: true },
  state:   { type: String, required: true },
  zip:     { type: String, required: true },

  units: { type: Number, default: 1 },

  amenities: [String],
  images:    [String],

  tenants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    unit:   String,
    name:   String,   // cached from User for quick display
    email:  String,   // cached from User for quick display
    since:  { type: Date, default: Date.now },
  }],

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

propertySchema.virtual('fullAddress').get(function () {
  return `${this.address}, ${this.city}, ${this.state} ${this.zip}`;
});

propertySchema.set('toJSON', { virtuals: true });
propertySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Property', propertySchema);