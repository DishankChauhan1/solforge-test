const crypto = require('crypto');

// The webhook secret that's configured in Firebase
const WEBHOOK_SECRET = 'ac95b2fd7dcaad462a6df4eba79b48017556fcba';

// Simulate a GitHub WebHook request body
// This is what our Cloud Function would receive in request.rawBody
const rawBody = `{"action":"opened","repository":{"id":123456,"full_name":"user/repo"},"sender":{"login":"testuser"}}`;

// Simulate already-parsed JSON (what Express would put in request.body)
const parsedBody = JSON.parse(rawBody);

console.log('Raw body:', rawBody);
console.log('Parsed body:', parsedBody);
console.log('Secret:', WEBHOOK_SECRET);

// Calculate signatures from the raw body string
const hmacSha1 = crypto.createHmac('sha1', WEBHOOK_SECRET);
hmacSha1.update(rawBody);
const sha1Signature = `sha1=${hmacSha1.digest('hex')}`;

const hmacSha256 = crypto.createHmac('sha256', WEBHOOK_SECRET);
hmacSha256.update(rawBody);
const sha256Signature = `sha256=${hmacSha256.digest('hex')}`;

console.log('SHA-1 Header Value:', sha1Signature);
console.log('SHA-256 Header Value:', sha256Signature);

// Simulate the data that would be received by our function
function simulateWebhookFunction() {
  // GitHub sends these headers with the webhook
  const headers = {
    'x-hub-signature': sha1Signature,
    'x-hub-signature-256': sha256Signature,
    'x-github-event': 'pull_request',
    'content-type': 'application/json'
  };

  // Mock Express request object
  const req = {
    headers: headers,
    rawBody: Buffer.from(rawBody, 'utf8'),  // Firebase Functions sets this
    body: parsedBody,                       // Express parses the JSON
    method: 'POST'
  };

  // Signature verification function similar to what's in our Cloud Function
  function verifySignature(req) {
    // Get signatures from headers
    const signature = req.headers['x-hub-signature'];
    const signatureSha256 = req.headers['x-hub-signature-256'];
    
    // Get the raw body for verification (this is what we fixed in our function)
    const bodyToVerify = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
    
    // Try SHA-256 signature first
    if (signatureSha256) {
      const [algorithm, signatureValue] = signatureSha256.split('=');
      
      if (algorithm && signatureValue) {
        const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
        hmac.update(bodyToVerify);
        const calculatedSignature = hmac.digest('hex');
        
        try {
          const result = crypto.timingSafeEqual(
            Buffer.from(calculatedSignature, 'hex'),
            Buffer.from(signatureValue, 'hex')
          );
          
          console.log('SHA-256 Verification Result:', result);
          if (result) return true;
        } catch (err) {
          console.error('SHA-256 Verification Error:', err);
        }
      }
    }
    
    // Fall back to SHA-1
    if (signature) {
      const [algorithm, signatureValue] = signature.split('=');
      
      if (algorithm && signatureValue) {
        const hmac = crypto.createHmac('sha1', WEBHOOK_SECRET);
        hmac.update(bodyToVerify);
        const calculatedSignature = hmac.digest('hex');
        
        try {
          const result = crypto.timingSafeEqual(
            Buffer.from(calculatedSignature, 'hex'),
            Buffer.from(signatureValue, 'hex')
          );
          
          console.log('SHA-1 Verification Result:', result);
          return result;
        } catch (err) {
          console.error('SHA-1 Verification Error:', err);
        }
      }
    }
    
    return false;
  }

  // Test the verification
  const isValid = verifySignature(req);
  console.log('Overall Verification Result:', isValid);
}

// Simulate the wrong JSON.stringify scenario that might be happening
function demonstrateJsonStringifyIssue() {
  console.log('\n--- Demonstrating potential JSON.stringify issues ---');
  
  // Here's what might be happening in the Cloud Function:
  // Instead of using the raw request body, it might be re-stringifying
  // the parsed JSON, which can result in different string output.
  
  const restringified = JSON.stringify(parsedBody);
  
  console.log('Original raw body:', rawBody);
  console.log('Re-stringified body:', restringified);
  console.log('Are they equal?', rawBody === restringified);
  
  // Calculate signature with the re-stringified body
  const hmacReSha256 = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmacReSha256.update(restringified);
  const reSignature = `sha256=${hmacReSha256.digest('hex')}`;
  
  console.log('Original SHA-256 signature:', sha256Signature);
  console.log('Re-stringified SHA-256 signature:', reSignature);
  console.log('Are signatures equal?', sha256Signature === reSignature);
  
  // This demonstrates why using request.rawBody is essential
}

// Run the simulations
console.log('\n--- Simulating webhook function ---');
simulateWebhookFunction();
demonstrateJsonStringifyIssue(); 