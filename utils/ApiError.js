class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }

  static badRequest(msg)   { return new ApiError(msg, 400); }
  static unauthorized(msg) { return new ApiError(msg || 'Unauthorized', 401); }
  static forbidden(msg)    { return new ApiError(msg || 'Forbidden', 403); }
  static notFound(msg)     { return new ApiError(msg || 'Not found', 404); }
  static internal(msg)     { return new ApiError(msg || 'Internal server error', 500); }
}

module.exports = ApiError;
