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
exports.getGithubUsername = exports.verifyPullRequest = exports.extractPRDetails = void 0;
const rest_1 = require("@octokit/rest");
const functions = __importStar(require("firebase-functions"));
const octokit = new rest_1.Octokit({
    auth: functions.config().github.token,
});
const extractPRDetails = (prUrl) => {
    try {
        const url = new URL(prUrl);
        const [, owner, repo, , pull_number] = url.pathname.split('/');
        return {
            owner,
            repo,
            pull_number: parseInt(pull_number),
        };
    }
    catch (error) {
        console.error('Error parsing PR URL:', error);
        return null;
    }
};
exports.extractPRDetails = extractPRDetails;
const verifyPullRequest = async (prUrl, expectedAuthor) => {
    var _a;
    const prDetails = (0, exports.extractPRDetails)(prUrl);
    if (!prDetails) {
        return { isValid: false, error: 'Invalid PR URL format' };
    }
    try {
        const { data: pr } = await octokit.pulls.get(Object.assign({}, prDetails));
        // Check if PR is merged
        if (!pr.merged) {
            return { isValid: false, error: 'Pull request is not merged' };
        }
        // Check if author matches
        if (((_a = pr.user) === null || _a === void 0 ? void 0 : _a.login.toLowerCase()) !== expectedAuthor.toLowerCase()) {
            return { isValid: false, error: 'Pull request author does not match' };
        }
        return { isValid: true };
    }
    catch (error) {
        console.error('Error verifying PR:', error);
        return { isValid: false, error: 'Error verifying pull request' };
    }
};
exports.verifyPullRequest = verifyPullRequest;
const getGithubUsername = async (githubToken) => {
    try {
        const response = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `token ${githubToken}`,
                Accept: "application/vnd.github.v3+json",
            },
        });
        if (!response.ok) {
            throw new functions.https.HttpsError("unauthenticated", "Invalid GitHub token");
        }
        const user = await response.json();
        return user.login;
    }
    catch (error) {
        console.error("Error fetching GitHub username:", error);
        throw error;
    }
};
exports.getGithubUsername = getGithubUsername;
//# sourceMappingURL=github.js.map