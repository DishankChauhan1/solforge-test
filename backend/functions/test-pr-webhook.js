#!/usr/bin/env node

/**
 * Test Pull Request Webhook
 * 
 * This script tests your GitHub webhook with a simulated pull request event
 */

const crypto = require('crypto');
const https = require('https');

// Configuration
const WEBHOOK_URL = 'https://githubwebhookhandler-eshmuwh26a-uc.a.run.app';
const WEBHOOK_SECRET = 'ac95b2fd7dcaad462a6df4eba79b48017556fcba';
const EVENT_TYPE = 'pull_request';

// Create a realistic pull request payload
const payload = JSON.stringify({
  "action": "opened",
  "number": 101,
  "pull_request": {
    "url": "https://api.github.com/repos/user/repo/pulls/101",
    "id": 1234567890,
    "node_id": "PR_abc123",
    "html_url": "https://github.com/user/repo/pull/101",
    "diff_url": "https://github.com/user/repo/pull/101.diff",
    "patch_url": "https://github.com/user/repo/pull/101.patch",
    "issue_url": "https://api.github.com/repos/user/repo/issues/101",
    "number": 101,
    "state": "open",
    "locked": false,
    "title": "Fix bug #100",
    "user": {
      "login": "octocat",
      "id": 1,
      "node_id": "MDQ6VXNlcjE=",
      "avatar_url": "https://github.com/images/error/octocat_happy.gif",
      "html_url": "https://github.com/octocat"
    },
    "body": "This PR fixes issue #100",
    "created_at": new Date().toISOString(),
    "updated_at": new Date().toISOString(),
    "closed_at": null,
    "merged_at": null,
    "merge_commit_sha": null,
    "assignee": null,
    "assignees": [],
    "requested_reviewers": [],
    "requested_teams": [],
    "labels": [],
    "milestone": null,
    "draft": false,
    "head": {
      "label": "user:feature-branch",
      "ref": "feature-branch",
      "sha": "abcdef1234567890",
      "user": {
        "login": "octocat",
        "id": 1
      },
      "repo": {
        "id": 123456,
        "node_id": "MDEwOlJlcG9zaXRvcnkxMjM0NTY=",
        "name": "repo",
        "full_name": "user/repo",
        "private": false,
        "owner": {
          "login": "user",
          "id": 1
        },
        "html_url": "https://github.com/user/repo",
        "description": "Test repository",
        "url": "https://api.github.com/repos/user/repo"
      }
    },
    "base": {
      "label": "user:main",
      "ref": "main",
      "sha": "0987654321abcdef",
      "user": {
        "login": "user",
        "id": 2
      },
      "repo": {
        "id": 123456,
        "node_id": "MDEwOlJlcG9zaXRvcnkxMjM0NTY=",
        "name": "repo",
        "full_name": "user/repo",
        "private": false,
        "owner": {
          "login": "user",
          "id": 2
        },
        "html_url": "https://github.com/user/repo",
        "description": "Test repository",
        "url": "https://api.github.com/repos/user/repo"
      }
    },
    "merged": false,
    "mergeable": true,
    "rebaseable": true,
    "mergeable_state": "clean",
    "merged_by": null,
    "comments": 0,
    "review_comments": 0,
    "maintainer_can_modify": true,
    "commits": 1,
    "additions": 10,
    "deletions": 2,
    "changed_files": 1
  },
  "repository": {
    "id": 123456,
    "node_id": "MDEwOlJlcG9zaXRvcnkxMjM0NTY=",
    "name": "repo",
    "full_name": "user/repo",
    "private": false,
    "owner": {
      "login": "user",
      "id": 2,
      "node_id": "MDQ6VXNlcjI=",
      "avatar_url": "https://github.com/images/error/user_happy.gif",
      "html_url": "https://github.com/user"
    },
    "html_url": "https://github.com/user/repo",
    "description": "Test repository",
    "fork": false,
    "url": "https://api.github.com/repos/user/repo",
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z",
    "pushed_at": new Date().toISOString(),
    "homepage": null,
    "size": 100,
    "stargazers_count": 10,
    "watchers_count": 10,
    "language": "JavaScript",
    "has_issues": true,
    "has_projects": true,
    "has_downloads": true,
    "has_wiki": true,
    "has_pages": false,
    "forks_count": 2,
    "mirror_url": null,
    "archived": false,
    "disabled": false,
    "open_issues_count": 5,
    "license": null,
    "allow_forking": true,
    "is_template": false,
    "web_commit_signoff_required": false,
    "topics": [],
    "visibility": "public",
    "forks": 2,
    "open_issues": 5,
    "watchers": 10,
    "default_branch": "main"
  },
  "sender": {
    "login": "octocat",
    "id": 1,
    "node_id": "MDQ6VXNlcjE=",
    "avatar_url": "https://github.com/images/error/octocat_happy.gif",
    "html_url": "https://github.com/octocat"
  }
});

// Calculate webhook signatures
const hmacSha1 = crypto.createHmac('sha1', WEBHOOK_SECRET);
hmacSha1.update(payload);
const sha1Signature = `sha1=${hmacSha1.digest('hex')}`;

const hmacSha256 = crypto.createHmac('sha256', WEBHOOK_SECRET);
hmacSha256.update(payload);
const sha256Signature = `sha256=${hmacSha256.digest('hex')}`;

console.log(`\nTesting webhook with ${EVENT_TYPE} event...`);
console.log(`URL: ${WEBHOOK_URL}`);
console.log(`Payload size: ${payload.length} bytes`);

// Send request to webhook
const urlObject = new URL(WEBHOOK_URL);
const options = {
  hostname: urlObject.hostname,
  port: urlObject.port || (urlObject.protocol === 'https:' ? 443 : 80),
  path: urlObject.pathname + urlObject.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'User-Agent': 'GitHub-Webhook-Tester/1.0',
    'X-GitHub-Event': EVENT_TYPE,
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
    console.log(`\nResponse status: ${res.statusCode}`);
    console.log(`Response body: ${data}`);
    
    if (res.statusCode === 200) {
      console.log('\n✅ Success! Your webhook handled the pull request event correctly.');
      console.log('Check your Firebase Function logs for more details about how it processed the event.');
    } else {
      console.log('\n❌ Error: Webhook returned a non-200 status code.');
      console.log('Check your Firebase Function logs for error messages.');
    }
  });
});

req.on('error', (error) => {
  console.error('\nError sending webhook request:', error.message);
});

// Send the webhook request
req.write(payload);
req.end();

console.log('\nWebhook request sent! Waiting for response...'); 