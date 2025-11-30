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
let firebaseStorage = null;
let firebaseFirestore = null;

/**
 * Initialize Firebase (called automatically when script loads)
 */
function initializeFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.error('[Firebase] Firebase SDK not loaded yet');
            return false;
        }

        // Initialize Firebase app (only once)
        if (!firebaseApp) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        }

        // Initialize services
        firebaseDatabase = firebase.database();

        // Initialize Storage if available
        if (typeof firebase.storage === 'function') {
            firebaseStorage = firebase.storage();
            console.log('[Firebase] ✅ Storage initialized');
        }

        // Initialize Firestore if available
        if (typeof firebase.firestore === 'function') {
            firebaseFirestore = firebase.firestore();
            console.log('[Firebase] ✅ Firestore initialized');
        }

        console.log('[Firebase] ✅ Initialized successfully');
        console.log('[Firebase] Database URL:', firebaseConfig.databaseURL);
        console.log('[Firebase] Storage Bucket:', firebaseConfig.storageBucket);
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
 * Get reference to Firebase storage
 * @returns {firebase.storage.Storage} Firebase storage instance
 */
function getFirebaseStorage() {
    if (!firebaseStorage) {
        initializeFirebase();
    }
    return firebaseStorage;
}

/**
 * Get reference to Firestore
 * @returns {firebase.firestore.Firestore} Firestore instance
 */
function getFirebaseFirestore() {
    if (!firebaseFirestore) {
        initializeFirebase();
    }
    return firebaseFirestore;
}

/**
 * Check if Firebase is ready
 * @returns {boolean} True if Firebase is initialized
 */
function isFirebaseReady() {
    return firebaseDatabase !== null;
}

/**
 * Check if Firebase Storage is ready
 * @returns {boolean} True if Storage is initialized
 */
function isStorageReady() {
    return firebaseStorage !== null;
}

/**
 * Check if Firestore is ready
 * @returns {boolean} True if Firestore is initialized
 */
function isFirestoreReady() {
    return firebaseFirestore !== null;
}

// Auto-initialize Firebase when script loads (with retry for CDN loading)
console.log('[Firebase Config] Script loaded, waiting for Firebase SDK...');

let initAttempts = 0;
const maxAttempts = 20; // Try for ~2 seconds

function attemptFirebaseInit() {
    initAttempts++;
    console.log(`[Firebase Config] Attempt ${initAttempts}/${maxAttempts} - typeof firebase:`, typeof firebase);

    if (typeof firebase !== 'undefined') {
        console.log('[Firebase Config] ✅ Firebase SDK found! Initializing...');
        const result = initializeFirebase();
        if (result) {
            console.log('[Firebase Config] ✅ Initialization successful!');
            console.log('[Firebase Config] Database ready at:', firebaseConfig.databaseURL);
        } else {
            console.error('[Firebase Config] ❌ Initialization failed!');
        }
        return true;
    } else if (initAttempts >= maxAttempts) {
        console.error('[Firebase Config] ❌ Firebase SDK never loaded after', maxAttempts, 'attempts');
        console.error('[Firebase Config] Expected CDN scripts: firebase-app-compat.js and firebase-database-compat.js');
        console.error('[Firebase Config] Falling back to Google Apps Script backend');
        return true; // Stop trying
    } else {
        // Try again in 100ms
        setTimeout(attemptFirebaseInit, 100);
        return false;
    }
}

// Start attempting to initialize
attemptFirebaseInit();
