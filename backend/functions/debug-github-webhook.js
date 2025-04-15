#!/usr/bin/env node

/**
 * GitHub Webhook Debug Tool
 * 
 * This script helps debug issues with GitHub webhook signature verification
 * It simulates how GitHub creates signatures and how Firebase verifies them
 */

const crypto = require('crypto');
const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Print header
console.log(`${colors.cyan}${colors.bold}
GitHub Webhook Debug Tool
------------------------${colors.reset}
This tool will help you troubleshoot GitHub webhook signature verification issues.
It validates your webhook configuration by simulating GitHub's signature creation.
`);

async function main() {
  try {
    // Get inputs from user
    const webhookUrl = await askQuestion(`${colors.blue}Enter your GitHub webhook URL:${colors.reset} `);
    const webhookSecret = await askQuestion(`${colors.blue}Enter your webhook secret:${colors.reset} `);
    
    console.log(`\n${colors.yellow}Testing with webhook URL:${colors.reset} ${webhookUrl}`);
    console.log(`${colors.yellow}Using webhook secret:${colors.reset} ${webhookSecret.substring(0, 4)}...${webhookSecret.substring(webhookSecret.length - 4)}`);
    
    // Create a simple test payload
    const payload = JSON.stringify({
      action: 'test',
      repository: { 
        full_name: 'user/repo',
        html_url: 'https://github.com/user/repo'
      },
      sender: { 
        login: 'testuser' 
      },
      test_id: Date.now().toString(),
      timestamp: new Date().toISOString()
    });
    
    console.log(`\n${colors.yellow}Created test payload:${colors.reset}`);
    console.log(payload);
    
    // Calculate signatures like GitHub would
    const hmacSha1 = crypto.createHmac('sha1', webhookSecret);
    hmacSha1.update(payload);
    const sha1Signature = `sha1=${hmacSha1.digest('hex')}`;
    
    const hmacSha256 = crypto.createHmac('sha256', webhookSecret);
    hmacSha256.update(payload);
    const sha256Signature = `sha256=${hmacSha256.digest('hex')}`;
    
    console.log(`\n${colors.yellow}Calculated signatures:${colors.reset}`);
    console.log(`X-Hub-Signature: ${sha1Signature}`);
    console.log(`X-Hub-Signature-256: ${sha256Signature}`);
    
    // Test a few potential issues
    console.log(`\n${colors.yellow}Testing webhook connectivity...${colors.reset}`);
    
    // Make a real HTTP request to the webhook endpoint
    const result = await sendWebhookRequest(webhookUrl, payload, sha1Signature, sha256Signature);
    
    console.log(`\n${colors.bold}Results:${colors.reset}`);
    console.log(`Status code: ${result.statusCode}`);
    console.log(`Response: ${result.body}`);
    
    if (result.statusCode === 200) {
      console.log(`\n${colors.green}${colors.bold}✅ Success! Your webhook endpoint accepted the request.${colors.reset}`);
      console.log(`This indicates that signature verification is working correctly.`);
    } else if (result.statusCode === 401) {
      console.log(`\n${colors.red}${colors.bold}❌ Signature verification failed (401 Unauthorized)${colors.reset}`);
      console.log(`This usually indicates that your webhook secret doesn't match what's configured on your server.`);
      console.log(`Make sure your Firebase Functions config has the same secret: ${webhookSecret}`);
    } else {
      console.log(`\n${colors.yellow}${colors.bold}⚠️ Received unexpected status code ${result.statusCode}${colors.reset}`);
      console.log(`Your webhook handler returned a non-standard status code. Check the logs for more details.`);
    }
    
    console.log(`\n${colors.magenta}${colors.bold}Debugging tips:${colors.reset}`);
    console.log(`1. Check Firebase Functions logs for detailed error messages`);
    console.log(`2. Verify the webhook secret matches exactly between GitHub and Firebase`);
    console.log(`3. Make sure your webhook URL is correct`);
    console.log(`4. If using express middleware, ensure it preserves the raw body for verification`);
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bold}Error:${colors.reset}`, error.message);
  } finally {
    rl.close();
  }
}

// Helper function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Helper function to send a webhook request
function sendWebhookRequest(url, payload, sha1Signature, sha256Signature) {
  return new Promise((resolve, reject) => {
    const urlObject = new URL(url);
    
    const options = {
      hostname: urlObject.hostname,
      port: urlObject.port || (urlObject.protocol === 'https:' ? 443 : 80),
      path: urlObject.pathname + urlObject.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'GitHub-Webhook-Tester/1.0',
        'X-GitHub-Event': 'ping',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature': sha1Signature,
        'X-Hub-Signature-256': sha256Signature
      }
    };
    
    const protocol = urlObject.protocol === 'https:' ? https : require('http');
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(payload);
    req.end();
  });
}

// Run the main function
main().catch(error => {
  console.error(`\n${colors.red}${colors.bold}Fatal error:${colors.reset}`, error);
  process.exit(1);
}); 