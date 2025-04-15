# GitHub Webhook Setup and Troubleshooting Guide

This guide helps you set up and troubleshoot GitHub webhooks for your SolForge application.

## Current Configuration

Your GitHub webhook handler is configured with the following:

- **Secret**: `ac95b2fd7dcaad462a6df4eba79b48017556fcba`
- **URL**: `https://githubwebhookhandler-eshmuwh26a-uc.a.run.app`

## Setting Up GitHub Webhooks

1. Go to your GitHub repository
2. Click on **Settings** > **Webhooks** > **Add webhook**
3. Configure the webhook:
   - **Payload URL**: `https://githubwebhookhandler-eshmuwh26a-uc.a.run.app`
   - **Content type**: `application/json`
   - **Secret**: `ac95b2fd7dcaad462a6df4eba79b48017556fcba`
   - **SSL verification**: Enabled
   - **Events**: Select "Let me select individual events" and choose:
     - Pull requests
     - Pull request reviews
     - Ping (default)
4. Click **Add webhook**

## Webhook Secret Management

The webhook secret is used to verify that requests come from GitHub. It must match exactly between GitHub and your Firebase configuration.

### Viewing Current Secret

```bash
firebase functions:config:get
```

### Updating Webhook Secret

```bash
firebase functions:config:set github.webhook_secret=YOUR_NEW_SECRET
firebase deploy --only functions:githubWebhookHandler
```

Then update the same secret in your GitHub repository webhook settings.

## Troubleshooting

### Common Issues

1. **401 Invalid Signature Error**:
   - The most common cause is a mismatch between the webhook secret in GitHub and Firebase
   - Copy-paste errors with the secret (hidden characters, spaces, etc.)
   - The payload being modified before signature verification

2. **Webhook Not Triggering**:
   - Incorrect webhook URL
   - Events not properly selected in GitHub
   - Repository permissions issues

### Using the Debug Tool

We've created a debug tool to help troubleshoot webhook issues:

```bash
node debug-github-webhook.js
```

This tool will:
- Generate a test payload with the correct format
- Calculate the expected signatures using your secret
- Send a test request to your webhook endpoint
- Analyze the response to identify issues

## Webhook Payload Structure

GitHub sends different payload structures depending on the event type. Here are the main ones used in SolForge:

### Pull Request Event

Triggered when a pull request is opened, closed, reopened, etc.

```json
{
  "action": "opened",
  "number": 123,
  "pull_request": {
    "html_url": "https://github.com/user/repo/pull/123",
    "title": "Fix bug",
    "body": "Fixes #100",
    "user": {
      "login": "username"
    }
  },
  "repository": {
    "full_name": "user/repo",
    "html_url": "https://github.com/user/repo"
  }
}
```

### Pull Request Review Event

Triggered when a review is submitted, edited, or dismissed.

```json
{
  "action": "submitted",
  "review": {
    "state": "approved",
    "user": {
      "login": "reviewer"
    }
  },
  "pull_request": {
    "html_url": "https://github.com/user/repo/pull/123"
  }
}
```

## Logging and Monitoring

To see detailed logs from your webhook handler:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Navigate to **Functions** > **Logs**
3. Filter for "githubWebhookHandler"

The logs include detailed information about:
- Request headers and payload
- Signature verification steps
- Bounty status updates
- Any errors encountered

## How GitHub Webhook Verification Works

1. GitHub calculates a signature using HMAC with your secret and the payload
2. The signature is sent in the `X-Hub-Signature` (SHA-1) and `X-Hub-Signature-256` (SHA-256) headers
3. Your webhook handler calculates the signature using the same method
4. If the signatures match, the request is verified as coming from GitHub

## Need More Help?

If you're still having issues:

1. Check the Firebase Function logs for detailed error messages
2. Use the debug tool to simulate GitHub webhook requests
3. Verify all configuration values are correct
4. Consider temporarily enabling detailed logging for troubleshooting 