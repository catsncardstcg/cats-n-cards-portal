/**
 * Firebase Configuration for Cats N Cards Portal
 * Fast backend for user mapping (LINE ID <-> TikTok username)
 */

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD1LsJ_NlxOFGpeSp6BeeUzFIhEMOsMVsY",
    authDomain: "cats-n-cards-tcg.firebaseapp.com",
    databaseURL: "https://cats-n-cards-tcg-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "cats-n-cards-tcg",
    storageBucket: "cats-n-cards-tcg.firebasestorage.app",
    messagingSenderId: "62209237814",
    appId: "1:62209237814:web:08b5039c6b819781ebc997"
};

// Initialize Firebase
let firebaseApp = null;
let firebaseDatabase = null;

/**
 * Initialize Firebase (called automatically when script loads)
 */
function initializeFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.error('[Firebase] Firebase SDK not loaded yet');
            return false;
        }

        // Initialize Firebase app
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseDatabase = firebase.database();

        console.log('[Firebase] ✅ Initialized successfully');
        console.log('[Firebase] Database URL:', firebaseConfig.databaseURL);
        return true;
    } catch (error) {
        console.error('[Firebase] Initialization error:', error);
        return false;
    }
}

/**
 * Get reference to Firebase database
 * @returns {firebase.database.Database} Firebase database instance
 */
function getFirebaseDatabase() {
    if (!firebaseDatabase) {
        initializeFirebase();
    }
    return firebaseDatabase;
}

/**
 * Check if Firebase is ready
 * @returns {boolean} True if Firebase is initialized
 */
function isFirebaseReady() {
    return firebaseDatabase !== null;
}

// Auto-initialize Firebase when script loads
console.log('[Firebase Config] Script loaded');
console.log('[Firebase Config] Checking if Firebase SDK is available...');
console.log('[Firebase Config] typeof firebase:', typeof firebase);

if (typeof firebase !== 'undefined') {
    console.log('[Firebase Config] ✅ Firebase SDK found, initializing...');
    const result = initializeFirebase();
    if (result) {
        console.log('[Firebase Config] ✅ Initialization successful!');
    } else {
        console.error('[Firebase Config] ❌ Initialization failed!');
    }
} else {
    console.error('[Firebase Config] ❌ Firebase SDK not loaded! Check if CDN scripts are loading.');
    console.error('[Firebase Config] Expected scripts: firebase-app-compat.js and firebase-database-compat.js');
}
