const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  name:        { type: String, required: true, trim: true },
  avatar:      { type: String, default: null },
  phone:       { type: String, default: null },

  role: {
    type: String,
    enum: ['tenant', 'landlord', 'admin'],
    default: 'tenant',
  },

  // Tenant fields
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  unit:       { type: String, default: null },

  // Landlord fields
  properties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],

  notifications: {
    email: { type: Boolean, default: true },
    push:  { type: Boolean, default: true },
  },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.virtual('displayName').get(function () {
  return this.name || this.email;
});

userSchema.methods.toPublicJSON = function () {
  return {
    id:         this._id,
    name:       this.name,
    email:      this.email,
    avatar:     this.avatar,
    role:       this.role,
    propertyId: this.propertyId,
    unit:       this.unit,
    createdAt:  this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);