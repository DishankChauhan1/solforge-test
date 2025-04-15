"use strict";
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
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
exports.webhookTest = exports.githubWebhookHandler = exports.getBountyById = exports.getAllBounties = exports.claimBountyHandler = exports.createBountyHandler = exports.verifyPR = void 0;
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const bounties_1 = require("./routes/bounties");
Object.defineProperty(exports, "verifyPR", { enumerable: true, get: function () { return bounties_1.verifyPR; } });
Object.defineProperty(exports, "createBountyHandler", { enumerable: true, get: function () { return bounties_1.createBountyHandler; } });
Object.defineProperty(exports, "claimBountyHandler", { enumerable: true, get: function () { return bounties_1.claimBountyHandler; } });
Object.defineProperty(exports, "getAllBounties", { enumerable: true, get: function () { return bounties_1.getAllBounties; } });
Object.defineProperty(exports, "getBountyById", { enumerable: true, get: function () { return bounties_1.getBountyById; } });
const path = __importStar(require("path"));
const github_webhooks_1 = require("./routes/github-webhooks");
Object.defineProperty(exports, "githubWebhookHandler", { enumerable: true, get: function () { return github_webhooks_1.githubWebhookHandler; } });
Object.defineProperty(exports, "webhookTest", { enumerable: true, get: function () { return github_webhooks_1.webhookTest; } });
// Set global options for all functions
(0, v2_1.setGlobalOptions)({
    maxInstances: 10,
});
// Initialize Firebase Admin with service account
try {
    // Try to load the service account file
    const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
    });
}
catch (error) {
    // Fallback to application default credentials
    console.log('Failed to load service account, using application default credentials');
    admin.initializeApp();
}
// Start writing functions
// https://firebase.google.com/docs/functions/typescript
// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
//# sourceMappingURL=index.js.map