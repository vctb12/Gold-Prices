'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { successResponse, errorResponse } = require('../server/lib/api-response');

test('successResponse returns standard success schema', () => {
  const payload = successResponse(
    { value: 42 },
    {
      source: 'unit-test',
      freshness: 'fresh',
    }
  );
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.data, { value: 42 });
  assert.equal(typeof payload.meta.timestamp, 'string');
  assert.equal(payload.meta.source, 'unit-test');
  assert.equal(payload.meta.freshness, 'fresh');
});

test('errorResponse returns standard error schema', () => {
  const payload = errorResponse('VALIDATION_ERROR', 'Bad request');
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
  assert.equal(payload.error.message, 'Bad request');
});
