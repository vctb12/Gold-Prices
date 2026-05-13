'use strict';

const morgan = require('morgan');
const MAX_USER_AGENT_LENGTH = 200;

function createRequestLogger() {
  return morgan((tokens, req, res) => {
    const status = Number(tokens.status(req, res) || 0);
    const responseTimeMs = Number(tokens['response-time'](req, res) || 0);

    return JSON.stringify({
      ts: new Date().toISOString(),
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      method: tokens.method(req, res),
      path: req.path,
      status,
      responseTimeMs,
      contentLength: Number(tokens.res(req, res, 'content-length') || 0) || null,
      ip: req.ip || req.socket?.remoteAddress || null,
      userAgent: (tokens.req(req, res, 'user-agent') || '').slice(0, MAX_USER_AGENT_LENGTH),
    });
  });
}

module.exports = {
  createRequestLogger,
};
