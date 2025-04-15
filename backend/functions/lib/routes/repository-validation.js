"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPullRequestForBounty = exports.validateGitHubRepository = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const github_app_1 = require("../services/github-app");
/**
 * Validates a GitHub repository URL
 *
 * This function checks if:
 * 1. The repository exists
 * 2. Our GitHub App has access to it
 * 3. The URL format is valid
 */
exports.validateGitHubRepository = (0, https_1.onCall)({
    maxInstances: 10,
    region: 'us-central1'
}, async (request) => {
    try {
        const { repositoryUrl } = request.data;
        if (!repositoryUrl) {
            return {
                valid: false,
                error: 'Repository URL is required'
            };
        }
        firebase_functions_1.logger.info(`Validating repository URL: ${repositoryUrl}`);
        const result = await (0, github_app_1.validateRepository)(repositoryUrl);
        if (result.isValid) {
            firebase_functions_1.logger.info(`Repository ${result.owner}/${result.repo} is valid`);
            return {
                valid: true,
                owner: result.owner,
                repo: result.repo
            };
        }
        else {
            firebase_functions_1.logger.warn(`Invalid repository: ${repositoryUrl}`, result.error);
            return {
                valid: false,
                error: result.error || 'Repository validation failed',
                owner: result.owner,
                repo: result.repo
            };
        }
    }
    catch (error) {
        firebase_functions_1.logger.error('Error validating repository:', error);
        return {
            valid: false,
            error: 'An unexpected error occurred while validating the repository'
        };
    }
});
/**
 * Verifies a pull request is valid for claiming a bounty
 *
 * This function checks if:
 * 1. The PR exists
 * 2. The PR is merged
 * 3. The PR references the issue
 * 4. The PR author matches the expected author (if provided)
 */
exports.verifyPullRequestForBounty = (0, https_1.onCall)({
    maxInstances: 10,
    region: 'us-central1'
}, async (request) => {
    try {
        const { pullRequestUrl, issueUrl, expectedAuthor } = request.data;
        if (!pullRequestUrl) {
            return {
                valid: false,
                error: 'Pull request URL is required'
            };
        }
        if (!issueUrl) {
            return {
                valid: false,
                error: 'Issue URL is required'
            };
        }
        firebase_functions_1.logger.info(`Verifying pull request: ${pullRequestUrl} for issue: ${issueUrl}`);
        // Import the function dynamically to avoid circular dependencies
        const { verifyPullRequestForBounty: verifyPR } = await import('../services/github-app.js');
        const result = await verifyPR(pullRequestUrl, issueUrl, expectedAuthor);
        if (result.isValid) {
            firebase_functions_1.logger.info(`Pull request ${pullRequestUrl} is valid for bounty`);
            return {
                valid: true,
                pullRequest: result.pullRequest
            };
        }
        else {
            firebase_functions_1.logger.warn(`Invalid pull request: ${pullRequestUrl}`, result.error);
            return {
                valid: false,
                error: result.error || 'Pull request validation failed',
                pullRequest: result.pullRequest
            };
        }
    }
    catch (error) {
        firebase_functions_1.logger.error('Error verifying pull request:', error);
        return {
            valid: false,
            error: 'An unexpected error occurred while verifying the pull request'
        };
    }
});
//# sourceMappingURL=repository-validation.js.map