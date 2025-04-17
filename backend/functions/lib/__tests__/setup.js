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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testEnv = void 0;
const admin = __importStar(require("firebase-admin"));
const firebase_functions_test_1 = __importDefault(require("firebase-functions-test"));
const globals_1 = require("@jest/globals");
const dotenv = __importStar(require("dotenv"));
// Load test environment variables
dotenv.config({ path: '.env.test' });
// Initialize Firebase Admin with a test project config
const testConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'test-project',
};
// Set environment variables for emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
// Initialize admin SDK
if (!admin.apps.length) {
    admin.initializeApp(testConfig);
}
// Initialize the firebase-functions-test SDK
exports.testEnv = (0, firebase_functions_test_1.default)(testConfig, './service-account.json');
// Global test setup
(0, globals_1.beforeAll)(() => {
    // Add any global setup here
    console.log('Using test configuration with Firebase emulators');
});
// Global test teardown
(0, globals_1.afterAll)(async () => {
    // Clean up test environment
    await Promise.all(admin.apps.map(app => app?.delete()));
    exports.testEnv.cleanup();
});
// Reset state between tests
(0, globals_1.afterEach)(async () => {
    // Clear any test data from Firestore
    const collections = ['bounties', 'users', 'payments'];
    try {
        await Promise.all(collections.map(async (collection) => {
            const snapshot = await admin.firestore().collection(collection).get();
            if (snapshot.empty)
                return;
            const batch = admin.firestore().batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }));
    }
    catch (error) {
        console.warn('Error cleaning up test data:', error);
    }
});
//# sourceMappingURL=setup.js.map