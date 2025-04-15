const crypto = require('crypto');

// The webhook secret that's configured in Firebase
const WEBHOOK_SECRET = 'ac95b2fd7dcaad462a6df4eba79b48017556fcba';

// Sample payload (this would be the body GitHub sends)
const payload = JSON.stringify({
  action: 'opened',
  repository: { full_name: 'test/repo' },
  sender: { login: 'testuser' }
});

console.log('Payload:', payload);
console.log('Secret:', WEBHOOK_SECRET);
console.log('Payload length:', payload.length);

// Calculate SHA-1 signature
const hmacSha1 = crypto.createHmac('sha1', WEBHOOK_SECRET);
hmacSha1.update(payload);
const signatureSha1 = hmacSha1.digest('hex');
console.log('SHA-1 Signature:', `sha1=${signatureSha1}`);

// Calculate SHA-256 signature
const hmacSha256 = crypto.createHmac('sha256', WEBHOOK_SECRET);
hmacSha256.update(payload);
const signatureSha256 = hmacSha256.digest('hex');
console.log('SHA-256 Signature:', `sha256=${signatureSha256}`);

// This is how to verify a signature
function verifySignature(payload, secret, receivedSignature) {
  // Split the signature header to get the algorithm and value
  const [algorithm, signatureValue] = receivedSignature.split('=');
  
  // Create HMAC with the appropriate algorithm
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(payload);
  const calculatedSignature = hmac.digest('hex');
  
  // Compare calculated signature with received signature
  try {
    const result = crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, 'hex'),
      Buffer.from(signatureValue, 'hex')
    );
    return result;
  } catch (err) {
    console.error('Error comparing signatures:', err);
    return false;
  }
}

// Test verification
const testSha1Signature = `sha1=${signatureSha1}`;
const testSha256Signature = `sha256=${signatureSha256}`;

console.log('\nVerifying SHA-1 signature:');
console.log(verifySignature(payload, WEBHOOK_SECRET, testSha1Signature));

console.log('\nVerifying SHA-256 signature:');
console.log(verifySignature(payload, WEBHOOK_SECRET, testSha256Signature)); 