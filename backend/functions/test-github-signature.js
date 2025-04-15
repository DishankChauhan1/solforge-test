const crypto = require('crypto');

// The webhook secret that's configured in Firebase
const WEBHOOK_SECRET = 'ac95b2fd7dcaad462a6df4eba79b48017556fcba';

// This is the actual payload GitHub sent (based on the user's info)
// We're recreating it from the error message content
const payload = JSON.stringify({
  "ref": "refs/heads/main",
  "before": "some-commit-hash",
  "after": "some-other-commit-hash",
  "repository": {
    "id": 123456789,
    "node_id": "R_abc123",
    "name": "SolForge",
    "full_name": "user/SolForge",
    "private": false
  },
  "pusher": {
    "name": "username",
    "email": "user@example.com"
  },
  "sender": {
    "login": "username"
  }
});

console.log('Payload:', payload);
console.log('Secret:', WEBHOOK_SECRET);
console.log('Payload length:', payload.length);

// The signatures from the request headers (replace with actual values from your error logs)
const receivedSha1Signature = "sha1=some-value";
const receivedSha256Signature = "sha256=some-value";

// Calculate what the signatures should be with our secret
const hmacSha1 = crypto.createHmac('sha1', WEBHOOK_SECRET);
hmacSha1.update(payload);
const calculatedSha1 = hmacSha1.digest('hex');
console.log('Calculated SHA-1 Signature:', `sha1=${calculatedSha1}`);
console.log('Received SHA-1 Signature:', receivedSha1Signature);
console.log('SHA-1 Match?', calculatedSha1 === receivedSha1Signature.replace('sha1=', ''));

const hmacSha256 = crypto.createHmac('sha256', WEBHOOK_SECRET);
hmacSha256.update(payload);
const calculatedSha256 = hmacSha256.digest('hex');
console.log('Calculated SHA-256 Signature:', `sha256=${calculatedSha256}`);
console.log('Received SHA-256 Signature:', receivedSha256Signature);
console.log('SHA-256 Match?', calculatedSha256 === receivedSha256Signature.replace('sha256=', ''));

// Common issues that cause signature verification failures:
console.log('\nPossible issues that cause signature verification failures:');
console.log('1. Webhook secret mismatch between GitHub and Firebase');
console.log('2. Payload format/content mismatch');
console.log('3. Encoding issues in the payload');
console.log('4. Header value parsing issues');

// Check if JSON.stringify produces consistent results
const payload2 = JSON.stringify({
  "ref": "refs/heads/main",
  "before": "some-commit-hash",
  "after": "some-other-commit-hash",
  "repository": {
    "id": 123456789,
    "node_id": "R_abc123",
    "name": "SolForge",
    "full_name": "user/SolForge",
    "private": false
  },
  "pusher": {
    "name": "username",
    "email": "user@example.com"
  },
  "sender": {
    "login": "username"
  }
});

console.log('\nTesting consistency of JSON.stringify:');
console.log('Original payload length:', payload.length);
console.log('Second payload length:', payload2.length);
console.log('Payloads match exactly?', payload === payload2);

// Test how Firebase might handle the payload
const firebasePayload = JSON.stringify(JSON.parse(payload));
console.log('\nTesting Firebase payload handling:');
console.log('Firebase-processed payload length:', firebasePayload.length);
console.log('Original and Firebase payload match exactly?', payload === firebasePayload);

// Calculate Firebase signature
const hmacSha256Firebase = crypto.createHmac('sha256', WEBHOOK_SECRET);
hmacSha256Firebase.update(firebasePayload);
const calculatedSha256Firebase = hmacSha256Firebase.digest('hex');
console.log('Firebase-processed SHA-256 Signature:', `sha256=${calculatedSha256Firebase}`); 