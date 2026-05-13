'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const tweetModulePath = path.resolve(__dirname, '..', 'scripts', 'node', 'tweet-gold-price.js');
const { buildOAuthHeader, buildTweetText, createOAuth1RequestSignature } = require(tweetModulePath);

function parseOAuthHeader(authorizationValue) {
  assert.match(authorizationValue, /^OAuth /);
  const payload = authorizationValue.slice('OAuth '.length);
  return Object.fromEntries(
    payload.split(', ').map((entry) => {
      const [rawKey, rawQuotedValue = '""'] = entry.split('=');
      return [rawKey, decodeURIComponent(rawQuotedValue.slice(1, -1))];
    })
  );
}

test('buildOAuthHeader() includes oauth_signature and remains deterministic with fixed nonce/timestamp', async () => {
  const authA = await buildOAuthHeader(
    'POST',
    'https://api.twitter.com/2/tweets',
    'consumer-key',
    'consumer-secret',
    'token-value',
    'token-signing-secret',
    { nonce: 'fixednonce123', timestamp: '1710000000' }
  );
  const authB = await buildOAuthHeader(
    'POST',
    'https://api.twitter.com/2/tweets',
    'consumer-key',
    'consumer-secret',
    'token-value',
    'token-signing-secret',
    { nonce: 'fixednonce123', timestamp: '1710000000' }
  );

  const parsedA = parseOAuthHeader(authA.Authorization);
  const parsedB = parseOAuthHeader(authB.Authorization);
  assert.equal(parsedA.oauth_signature_method, 'HMAC-SHA256');
  assert.ok(parsedA.oauth_signature);
  assert.equal(parsedA.oauth_signature, parsedB.oauth_signature);
  assert.equal(parsedA.oauth_timestamp, '1710000000');
  assert.equal(parsedA.oauth_nonce, 'fixednonce123');
  assert.ok(authA.Authorization.includes('oauth_signature='));
});

test('createOAuth1RequestSignature() changes when method/url/params input changes', async () => {
  const baseA = 'POST&https%3A%2F%2Fapi.twitter.com%2F2%2Ftweets&a%3D1%26b%3D2';
  const baseB = 'GET&https%3A%2F%2Fapi.twitter.com%2F2%2Ftweets&a%3D1%26b%3D2';
  const signatureA = await createOAuth1RequestSignature({
    oauthSignatureBaseString: baseA,
    oauthConsumerSigningSecret: 'consumer-secret',
    oauthAccessTokenSigningSecret: 'token-secret',
  });
  const signatureB = await createOAuth1RequestSignature({
    oauthSignatureBaseString: baseB,
    oauthConsumerSigningSecret: 'consumer-secret',
    oauthAccessTokenSigningSecret: 'token-secret',
  });

  assert.notEqual(signatureA, signatureB);
});

test('buildOAuthHeader() never embeds raw signing secrets', async () => {
  const consumerSecret = 'my-very-secret-app-key';
  const tokenSecret = 'my-very-secret-user-key';
  const auth = await buildOAuthHeader(
    'POST',
    'https://api.twitter.com/2/tweets',
    'consumer-key',
    consumerSecret,
    'token-value',
    tokenSecret,
    { nonce: 'n', timestamp: '1' }
  );
  assert.equal(auth.Authorization.includes(consumerSecret), false);
  assert.equal(auth.Authorization.includes(tokenSecret), false);
});

test('buildTweetText() returns non-empty tweet text for hourly template within platform limit guard', () => {
  const text = buildTweetText('hourly', {
    spotUsdPerOz: 3200.12,
    dayOpenUsdPerOz: 3191.31,
    generatedAt: '2026-05-13T12:00:00.000Z',
  });
  assert.ok(text.length > 0);
  assert.ok([...text].length <= 280);
});
