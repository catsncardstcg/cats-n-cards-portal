/**
 * Recipient Names Configuration for Cats N Cards TCG Portal - Backend
 *
 * This file contains the list of valid recipient names for payment verification.
 * You can easily edit this file to add, remove, or modify recipient names.
 *
 * HOW TO USE:
 * - Add new recipient names to the VALID_RECIPIENTS array
 * - Names should match exactly as they appear on bank statements
 * - Save the file after making changes and redeploy Cloud Functions
 */

// List of valid recipient names for payment verification
const VALID_RECIPIENTS = [
   
"นาย นทีธาร ป",
"นาย ณภัทร ป ",
"นทีธาร",
"ณภัทร",
"นทีธาร ป",
"ณภัทร ป"
];

/**
 * Payment verification configuration
 */
const VERIFICATION_CONFIG = {
    // Enable/disable recipient name verification
    ENABLE_RECIPIENT_VERIFICATION: true,

    // Matching mode: 'exact', 'contains', 'partial'
    MATCHING_MODE: 'contains',

    // Case sensitivity
    CASE_SENSITIVE: false,

    // Titles and prefixes to ignore
    IGNORE_TITLES: [
        'นาย', 'นาง', 'นางสาว', 'น.', 'น.ส.',
        'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'
    ],

    // Delivery fee configuration
    DELIVERY_FEE: {
        amount: 50, // Fixed delivery fee in THB
        tolerance: 5, // Acceptable variance in THB
    }
};

/**
 * Normalize recipient name for comparison
 * @param {string} name - Raw name from bank statement
 * @returns {string} - Normalized name
 */
function normalizeRecipientName(name) {
    if (!name) return '';

    let normalized = name.trim();

    // Remove titles and prefixes
    VERIFICATION_CONFIG.IGNORE_TITLES.forEach(title => {
        const titleRegex = new RegExp(`^${title}\\s*`, 'i');
        normalized = normalized.replace(titleRegex, '');
    });

    // Remove extra spaces and standardize
    normalized = normalized.replace(/\s+/g, ' ');

    if (!VERIFICATION_CONFIG.CASE_SENSITIVE) {
        normalized = normalized.toLowerCase();
    }

    return normalized.trim();
}

/**
 * Check if recipient name matches any valid recipients
 * @param {string} recipientName - Name from bank statement
 * @returns {boolean} - True if valid recipient
 */
function isValidRecipient(recipientName) {
    if (!VERIFICATION_CONFIG.ENABLE_RECIPIENT_VERIFICATION) {
        return true;
    }

    if (!recipientName) {
        console.log('[Recipient Verification] No recipient name provided');
        return false;
    }

    const normalizedInput = normalizeRecipientName(recipientName);
    console.log(`[Recipient Verification] Checking: "${recipientName}" -> "${normalizedInput}"`);

    const isValid = VALID_RECIPIENTS.some(validName => {
        const normalizedValid = normalizeRecipientName(validName);

        switch (VERIFICATION_CONFIG.MATCHING_MODE) {
            case 'exact':
                return normalizedInput === normalizedValid;
            case 'contains':
                return normalizedInput.includes(normalizedValid) ||
                       normalizedValid.includes(normalizedInput);
            case 'partial':
                return normalizedInput.includes(normalizedValid.substring(0, 3));
            default:
                return false;
        }
    });

    console.log(`[Recipient Verification] Result: ${isValid}`);
    return isValid;
}

/**
 * Check if payment amount is correct for delivery fee
 * @param {number} amount - Payment amount from bank statement
 * @returns {boolean} - True if amount is valid
 */
function isValidDeliveryFee(amount) {
    const { amount: expected, tolerance } = VERIFICATION_CONFIG.DELIVERY_FEE;
    const min = expected - tolerance;
    const max = expected + tolerance;

    const isValid = amount >= min && amount <= max;
    console.log(`[Payment Verification] Amount: ${amount}, Expected: ${expected}±${tolerance}, Valid: ${isValid}`);

    return isValid;
}

/**
 * Get all valid recipient names (for debugging)
 * @returns {Array} - Array of valid recipient names
 */
function getAllValidRecipients() {
    return [...VALID_RECIPIENTS];
}

/**
 * Add a new recipient name
 * @param {string} newName - New recipient name
 */
function addRecipientName(newName) {
    if (newName && !VALID_RECIPIENTS.includes(newName)) {
        VALID_RECIPIENTS.push(newName);
        console.log(`[Recipient Verification] Added new recipient: ${newName}`);
    }
}

/**
 * Remove a recipient name
 * @param {string} nameToRemove - Name to remove
 */
function removeRecipientName(nameToRemove) {
    const index = VALID_RECIPIENTS.indexOf(nameToRemove);
    if (index > -1) {
        VALID_RECIPIENTS.splice(index, 1);
        console.log(`[Recipient Verification] Removed recipient: ${nameToRemove}`);
    }
}

// Updated with recipient names - 2025-12-15
module.exports = {
    VALID_RECIPIENTS,
    VERIFICATION_CONFIG,
    isValidRecipient,
    isValidDeliveryFee,
    normalizeRecipientName,
    getAllValidRecipients,
    addRecipientName,
    removeRecipientName
};