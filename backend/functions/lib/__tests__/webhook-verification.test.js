"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const crypto = __importStar(require("crypto"));
const github_webhooks_1 = require("../routes/github-webhooks");
// Mock the config to use a known secret for testing
globals_1.jest.mock('../config', () => ({
    getGitHubConfig: globals_1.jest.fn().mockReturnValue({
        webhookSecret: 'test-webhook-secret'
    }),
    getConfig: globals_1.jest.fn().mockReturnValue({}),
    getLoggingConfig: globals_1.jest.fn().mockReturnValue({ verbose: false })
}));
(0, globals_1.describe)('GitHub Webhook Verification Tests', () => {
    // Test payload
    const testPayload = {
        action: 'ping',
        zen: 'Keep it logically awesome',
        hook_id: 12345,
        hook: {
            type: 'Repository',
            id: 12345,
            name: 'web',
            active: true,
            events: ['push', 'pull_request', 'pull_request_review'],
            config: {
                content_type: 'json',
                insecure_ssl: '0',
                url: 'https://example.com/webhook'
            }
        },
        repository: {
            id: 54321,
            name: 'test-repo',
            full_name: 'owner/test-repo',
            html_url: 'https://github.com/owner/test-repo'
        },
        sender: {
            login: 'testuser',
            id: 98765,
            avatar_url: 'https://github.com/testuser.png'
        }
    };
    (0, globals_1.it)('should accept requests with valid signatures', async () => {
        // Create payload buffer
        const payloadBuffer = Buffer.from(JSON.stringify(testPayload));
        // Generate a valid signature using the test secret
        const hmac = crypto.createHmac('sha256', 'test-webhook-secret');
        hmac.update(payloadBuffer);
        const signature = 'sha256=' + hmac.digest('hex');
        // Create mock request with valid signature
        const mockRequest = {
            headers: {
                'x-github-event': 'ping',
                'x-hub-signature-256': signature
            },
            body: testPayload,
            rawBody: payloadBuffer,
            get: (header) => mockRequest.headers[header.toLowerCase()]
        };
        // Create mock response object
        const mockResponse = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        // Process the webhook
        await (0, github_webhooks_1.githubWebhookHandler)(mockRequest, mockResponse);
        // Should be accepted (ping response with 200 status)
        (0, globals_1.expect)(mockResponse.status).toHaveBeenCalledWith(200);
        (0, globals_1.expect)(mockResponse.json).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            message: 'Webhook configured successfully'
        }));
    });
    (0, globals_1.it)('should reject requests with invalid signatures', async () => {
        // Create payload buffer
        const payloadBuffer = Buffer.from(JSON.stringify(testPayload));
        // Generate an invalid signature (wrong secret)
        const hmac = crypto.createHmac('sha256', 'wrong-secret');
        hmac.update(payloadBuffer);
        const invalidSignature = 'sha256=' + hmac.digest('hex');
        // Create mock request with invalid signature
        const mockRequest = {
            headers: {
                'x-github-event': 'ping',
                'x-hub-signature-256': invalidSignature
            },
            body: testPayload,
            rawBody: payloadBuffer,
            get: (header) => mockRequest.headers[header.toLowerCase()]
        };
        // Create mock response object
        const mockResponse = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        // Process the webhook
        await (0, github_webhooks_1.githubWebhookHandler)(mockRequest, mockResponse);
        // Should be rejected with 401 status
        (0, globals_1.expect)(mockResponse.status).toHaveBeenCalledWith(401);
        (0, globals_1.expect)(mockResponse.json).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            error: 'Invalid signature'
        }));
    });
    (0, globals_1.it)('should reject requests with missing signatures', async () => {
        // Create payload buffer
        const payloadBuffer = Buffer.from(JSON.stringify(testPayload));
        // Create mock request with no signature
        const mockRequest = {
            headers: {
                'x-github-event': 'ping'
                // No x-hub-signature-256 header
            },
            body: testPayload,
            rawBody: payloadBuffer,
            get: (header) => mockRequest.headers[header.toLowerCase()]
        };
        // Create mock response object
        const mockResponse = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        // Process the webhook
        await (0, github_webhooks_1.githubWebhookHandler)(mockRequest, mockResponse);
        // Should be rejected with 401 status
        (0, globals_1.expect)(mockResponse.status).toHaveBeenCalledWith(401);
        (0, globals_1.expect)(mockResponse.json).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            error: 'Invalid signature'
        }));
    });
    (0, globals_1.it)('should reject requests with missing raw body', async () => {
        // Generate a valid signature for an empty body
        const hmac = crypto.createHmac('sha256', 'test-webhook-secret');
        hmac.update(Buffer.from('{}'));
        const signature = 'sha256=' + hmac.digest('hex');
        // Create mock request with valid signature but no raw body
        const mockRequest = {
            headers: {
                'x-github-event': 'ping',
                'x-hub-signature-256': signature
            },
            body: {},
            // No rawBody property
            get: (header) => mockRequest.headers[header.toLowerCase()]
        };
        // Create mock response object
        const mockResponse = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        // Process the webhook
        await (0, github_webhooks_1.githubWebhookHandler)(mockRequest, mockResponse);
        // Should be rejected with 401 status
        (0, globals_1.expect)(mockResponse.status).toHaveBeenCalledWith(401);
        (0, globals_1.expect)(mockResponse.json).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            error: 'Invalid signature'
        }));
    });
});
//# sourceMappingURL=webhook-verification.test.js.map