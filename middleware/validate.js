const Joi = require('joi');

// Generic validator factory
const validate = (schema) => (req, res, next) => {
  if (!req.body) {
    return res.status(400).json({ success: false, message: 'Request body is missing' });
  }
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const messages = error.details.map(d => d.message.replace(/"/g, "'"));
    return res.status(400).json({ success: false, message: 'Validation error', errors: messages });
  }
  next();
};

// ── Schemas ──
const schemas = {
  updateRole: Joi.object({
    role: Joi.string().valid('tenant', 'landlord').required(),
  }),

  createProperty: Joi.object({
    name:    Joi.string().min(2).max(100).required(),
    address: Joi.string().min(5).max(200).required(),
    city:    Joi.string().required(),
    state:   Joi.string().required(),
    zip:     Joi.string().required(),
    units:   Joi.number().integer().min(1).max(999).default(1),
  }),

  createRequest: Joi.object({
    title:       Joi.string().min(5).max(150).required(),
    description: Joi.string().min(10).max(2000).required(),
    category:    Joi.string().valid('plumbing','electrical','hvac','structural','appliance','other').required(),
    priority:    Joi.string().valid('low','medium','high').required(),
    location:    Joi.string().max(100).required(),
    propertyId:  Joi.string().required(),
    unit:        Joi.string().max(20).required(),
  }),

  updateRequest: Joi.object({
    status:   Joi.string().valid('open','in-progress','completed','declined'),
    vendorId: Joi.string(),
    notes:    Joi.string().max(1000),
    budget:   Joi.number().min(0),
  }),

  createVendor: Joi.object({
    name:          Joi.string().min(2).max(100).required(),
    email:         Joi.string().email().required(),
    phone:         Joi.string().required(),
    specialties:   Joi.array().items(Joi.string()).min(1).required(),
    licenseNumber: Joi.string().optional(),
    serviceArea:   Joi.string().optional(),
  }),
};

module.exports = { validate, schemas };