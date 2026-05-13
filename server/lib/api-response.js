'use strict';

function successResponse(data, meta = {}) {
  return {
    ok: true,
    data: data ?? {},
    meta: {
      timestamp: new Date().toISOString(),
      source: meta.source || 'server',
      freshness: meta.freshness || 'unknown',
      ...(meta.extra && typeof meta.extra === 'object' ? meta.extra : {}),
    },
  };
}

function errorResponse(code, message, extra = {}) {
  const payload = {
    ok: false,
    error: {
      code: code || 'INTERNAL_ERROR',
      message: message || 'Unexpected error',
    },
  };

  if (extra && typeof extra === 'object' && Object.keys(extra).length > 0) {
    payload.error.details = extra;
  }

  return payload;
}

module.exports = {
  successResponse,
  errorResponse,
};
