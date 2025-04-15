# Setting Up a GitHub App for SolForge

This guide will walk you through the process of creating and configuring a GitHub App to replace the current webhook-based GitHub integration in SolForge.

## Why a GitHub App?

GitHub Apps provide several advantages over traditional webhooks:

1. **Better security** - Apps use installation tokens that are scoped to specific repositories
2. **Enhanced permissions model** - Fine-grained access control to GitHub APIs
3. **Higher API rate limits** - 5,000 requests per hour versus 60 per hour for personal access tokens
4. **Proper repository validation** - Apps can authenticate against specific repositories
5. **Improved user experience** - Users can install the app on their repositories with a few clicks

## Prerequisites

1. A GitHub account with the ability to create GitHub Apps
2. Firebase project with Functions already set up
3. Basic knowledge of GitHub and Firebase

## Step 1: Create a New GitHub App

1. Go to your GitHub account settings
2. Navigate to **Developer settings** > **GitHub Apps** > **New GitHub App**
3. Fill in the required information:
   - **GitHub App Name**: `SolForge` (or a custom name)
   - **Homepage URL**: Your application's URL (e.g., `https://solforge-main.web.app`)
   - **Webhook URL**: Your Firebase Function URL for the app webhook handler (e.g., `https://githubappwebhookhandler-eshmuwh26a-uc.a.run.app`)
   - **Webhook Secret**: Generate a secure random string for webhook verification

4. Set the following **Repository Permissions**:
   - **Issues**: Read & Write
   - **Pull Requests**: Read & Write
   - **Contents**: Read
   - **Metadata**: Read

5. Subscribe to the following **Events**:
   - **Issues**
   - **Issue comment**
   - **Pull request**
   - **Pull request review**
   - **Pull request review comment**

6. Set **Where can this GitHub App be installed?** to `Any account`

7. Click **Create GitHub App**

## Step 2: Generate a Private Key

After creating the app:

1. Navigate to your newly created GitHub App settings
2. Scroll down to the **Private keys** section
3. Click **Generate a private key**
4. Save the downloaded `.pem` file securely - you will need it for Firebase

## Step 3: Get App Information

Note down the following information from your GitHub App settings page:

- **App ID** (displayed near the top)
- **Client ID** (in the "About" section)
- **Client Secret** (in the "About" section)
- **Webhook Secret** (the one you created earlier)

## Step 4: Configure Firebase

1. Set the GitHub App configuration in Firebase:

```bash
firebase functions:config:set github.app_id="YOUR_APP_ID" \
    github.app_client_id="YOUR_CLIENT_ID" \
    github.app_client_secret="YOUR_CLIENT_SECRET" \
    github.app_webhook_secret="YOUR_WEBHOOK_SECRET"
```

2. For the private key, you have two options:

   a. Set it directly in Firebase config (replace newlines with `\n`):
   ```bash
   firebase functions:config:set github.app_private_key="-----BEGIN RSA PRIVATE KEY-----\nMII...\n-----END RSA PRIVATE KEY-----\n"
   ```

   b. Or upload the private key file to your Firebase project:
   ```bash
   # Upload the file to the backend/functions/ directory
   # The code will look for it at backend/functions/private-key.pem
   ```

3. Deploy the Firebase functions with the GitHub App implementation:
```bash
firebase deploy --only functions:githubAppWebhookHandler
```

## Step 5: Install the GitHub App

1. Go to your GitHub App's public page at `https://github.com/apps/YOUR-APP-NAME`
2. Click **Install App**
3. Choose the account where you want to install the app
4. Select which repositories you want to give the app access to:
   - For testing, select a specific repository
   - For production, you may want to enable it for all repositories
5. Click **Install**

## Step 6: Test the Integration

To test that your GitHub App is working correctly:

1. Create a new issue in a repository where the app is installed
2. Create a new bounty linked to this issue
3. Submit a pull request that references the issue
4. Verify that the bounty status updates correctly

You can also use the `githubAppWebhookTest` endpoint to test connectivity:
```
https://githubappwebhooktest-eshmuwh26a-uc.a.run.app
```

## Repository Validation

The new GitHub App integration includes repository validation functionality that:

1. Verifies a repository exists before creating a bounty for it
2. Checks that the GitHub App has access to the repository
3. Validates ownership of pull requests when claiming bounties
4. Properly checks that pull requests reference the correct issues

## Troubleshooting

### App Not Receiving Webhooks

1. Check the webhook URL in your GitHub App settings
2. Verify the webhook secret matches in both GitHub and Firebase
3. Look at GitHub App webhook deliveries in your GitHub App settings
4. Check Firebase Function logs for errors

### Authentication Issues

1. Verify that the App ID and private key are correct
2. Check the permissions settings in your GitHub App configuration
3. Make sure the app is installed on the repository you're trying to access

### Rate Limiting

GitHub Apps have higher rate limits, but they can still be exceeded:

- For API requests, the limit is 5,000 requests per hour per installation
- For GraphQL, the limit is 5,000 points per hour

## Next Steps

After setting up the GitHub App:

1. Update any client-side code to work with the new GitHub App authentication
2. Consider implementing additional features like:
   - Comment management on issues/PRs
   - Automated labeling of issues and PRs
   - Status checks for PRs

## Resources

- [GitHub Apps Documentation](https://docs.github.com/en/developers/apps/getting-started-with-apps/about-apps)
- [Octokit JS Documentation](https://github.com/octokit/octokit.js)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions) 