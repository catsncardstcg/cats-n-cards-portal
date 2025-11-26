/**
 * LIFF Initialization Module for Cats N Cards Portal
 * Handles LINE Front-end Framework initialization and user profile management
 */

// Configuration - UPDATE THIS with your LIFF ID from LINE Developers Console
const LIFF_ID = '2008574578-GqoeXVmV'; // Format: 1234567890-abcdefgh

// Global state
let liffState = {
    initialized: false,
    isInClient: false,
    profile: null,
    error: null
};

/**
 * Initialize LIFF SDK
 * @returns {Promise<Object>} LIFF state object
 */
async function initializeLIFF() {
    try {
        console.log('[LIFF] Initializing LIFF SDK...');

        // Initialize LIFF
        await liff.init({ liffId: LIFF_ID });

        liffState.initialized = true;
        liffState.isInClient = liff.isInClient();

        console.log('[LIFF] LIFF initialized successfully');
        console.log('[LIFF] Is in LINE browser:', liffState.isInClient);

        // If not in LINE browser, return early
        if (!liffState.isInClient) {
            console.log('[LIFF] Not running in LINE browser');
            liffState.error = 'not_in_line';
            return liffState;
        }

        // Check if user is logged in
        if (!liff.isLoggedIn()) {
            console.log('[LIFF] User not logged in, redirecting to LINE login...');
            liff.login();
            return liffState;
        }

        // Get user profile
        const profile = await liff.getProfile();
        liffState.profile = {
            userId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
            statusMessage: profile.statusMessage
        };

        console.log('[LIFF] User profile retrieved:', {
            userId: profile.userId,
            displayName: profile.displayName
        });

        return liffState;

    } catch (error) {
        console.error('[LIFF] Initialization error:', error);
        liffState.error = error.message || 'initialization_failed';
        liffState.initialized = false;
        return liffState;
    }
}

/**
 * Get current LIFF state
 * @returns {Object} Current LIFF state
 */
function getLIFFState() {
    return liffState;
}

/**
 * Get LINE user profile
 * @returns {Object|null} User profile or null if not available
 */
function getLINEProfile() {
    return liffState.profile;
}

/**
 * Check if LIFF is properly initialized and user is in LINE browser
 * @returns {boolean} True if LIFF is ready to use
 */
function isLIFFReady() {
    return liffState.initialized && liffState.isInClient && liffState.profile !== null;
}

/**
 * Get LINE user ID
 * @returns {string|null} LINE user ID or null
 */
function getLINEUserId() {
    return liffState.profile ? liffState.profile.userId : null;
}

/**
 * Get LINE display name
 * @returns {string|null} LINE display name or null
 */
function getLINEDisplayName() {
    return liffState.profile ? liffState.profile.displayName : null;
}

/**
 * Get LINE profile picture URL
 * @returns {string|null} Profile picture URL or null
 */
function getLINEPictureUrl() {
    return liffState.profile ? liffState.profile.pictureUrl : null;
}

/**
 * Close LIFF window
 */
function closeLIFF() {
    if (liffState.isInClient) {
        liff.closeWindow();
    }
}

/**
 * Send message to LINE chat (if in external browser)
 * @param {string} message - Message to send
 */
function sendLineMessage(message) {
    if (liff.isApiAvailable('shareTargetPicker')) {
        liff.shareTargetPicker([{
            type: 'text',
            text: message
        }]);
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeLIFF,
        getLIFFState,
        getLINEProfile,
        isLIFFReady,
        getLINEUserId,
        getLINEDisplayName,
        getLINEPictureUrl,
        closeLIFF,
        sendLineMessage
    };
}
