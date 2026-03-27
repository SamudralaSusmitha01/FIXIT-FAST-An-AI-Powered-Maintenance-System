/**
 * Notification service
 * Emits real-time Socket.io events and can be extended for push/email
 */

function emitToLandlord(io, landlordId, event, data) {
  if (!io) return;
  io.to(`landlord_${landlordId}`).emit(event, data);
}

function emitToRequest(io, requestId, event, data) {
  if (!io) return;
  io.to(`request_${requestId}`).emit(event, data);
}

// New request submitted — notify landlord
function notifyNewRequest(io, landlordId, request) {
  emitToLandlord(io, landlordId, 'new_request', {
    message: `New ${request.priority} priority request: ${request.title}`,
    requestId: request._id,
    priority: request.priority,
    category: request.category,
    unit: request.unit,
  });
}

// Status updated — notify tenant
function notifyStatusChange(io, request) {
  emitToRequest(io, request._id.toString(), 'status_updated', {
    requestId: request._id,
    status: request.status,
    message: getStatusMessage(request.status),
    updatedAt: new Date(),
  });
}

// Vendor assigned — notify tenant
function notifyVendorAssigned(io, request, vendor) {
  emitToRequest(io, request._id.toString(), 'vendor_assigned', {
    requestId: request._id,
    vendor: {
      name:        vendor.name,
      phone:       vendor.phone,
      avgRating:   vendor.stats.avgRating,
    },
    message: `${vendor.name} has been assigned to your request`,
  });
}

function getStatusMessage(status) {
  const messages = {
    'open':        'Your request has been received',
    'in-progress': 'A vendor is working on your issue',
    'completed':   'Your maintenance request has been completed!',
    'declined':    'Your request has been declined. Please contact your landlord.',
    'on-hold':     'Your request is temporarily on hold',
  };
  return messages[status] || 'Your request status has been updated';
}

module.exports = {
  notifyNewRequest,
  notifyStatusChange,
  notifyVendorAssigned,
};
