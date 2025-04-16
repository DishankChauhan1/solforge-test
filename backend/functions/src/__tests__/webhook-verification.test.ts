import { jest, describe, it, expect } from '@jest/globals';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';
import { githubWebhookHandler } from '../routes/github-webhooks';

// Mock the config to use a known secret for testing
jest.mock('../config', () => ({
  getGitHubConfig: jest.fn().mockReturnValue({
    webhookSecret: 'test-webhook-secret'
  }),
  getConfig: jest.fn().mockReturnValue({}),
  getLoggingConfig: jest.fn().mockReturnValue({ verbose: false })
}));

describe('GitHub Webhook Verification Tests', () => {
  // Extend Request to include rawBody as required by webhook handler
  interface WebhookRequest extends Request {
    rawBody: Buffer;
  }

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

  it('should accept requests with valid signatures', async () => {
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
      get: (header: string) => mockRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;
    
    // Create mock response object
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;
    
    // Process the webhook
    await githubWebhookHandler(mockRequest, mockResponse);
    
    // Should be accepted (ping response with 200 status)
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Webhook configured successfully'
      })
    );
  });

  it('should reject requests with invalid signatures', async () => {
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
      get: (header: string) => mockRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;
    
    // Create mock response object
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;
    
    // Process the webhook
    await githubWebhookHandler(mockRequest, mockResponse);
    
    // Should be rejected with 401 status
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid signature'
      })
    );
  });

  it('should reject requests with missing signatures', async () => {
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
      get: (header: string) => mockRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;
    
    // Create mock response object
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;
    
    // Process the webhook
    await githubWebhookHandler(mockRequest, mockResponse);
    
    // Should be rejected with 401 status
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid signature'
      })
    );
  });

  it('should reject requests with missing raw body', async () => {
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
      get: (header: string) => mockRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;
    
    // Create mock response object
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;
    
    // Process the webhook
    await githubWebhookHandler(mockRequest, mockResponse);
    
    // Should be rejected with 401 status
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid signature'
      })
    );
  });
}); 