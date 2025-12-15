/**
 * Recipient Names Configuration for Cats N Cards TCG Portal
 *
 * This file contains the list of valid recipient names for payment verification.
 * You can easily edit this file to add, remove, or modify recipient names.
 *
 * HOW TO USE:
 * - Add new recipient names to the RECIPIENT_NAMES array
 * - Names should match exactly as they appear on bank statements
 * - Save the file after making changes
 *
 * FORMATS:
 * - Use exact name spelling as it appears on bank accounts
 * - Include both Thai and English names if needed
 * - Case sensitive - use exact capitalization
 */

// List of valid recipient names for payment verification
const RECIPIENT_NAMES = [
    // Primary business accounts
    "นายสมชาย ใจดี",
    "สมชาย ใจดี",
    "Somchai Jaidee",

    // Additional business accounts
    "นางสาวมานี รักษ์ดี",
    "มานี รักษ์ดี",
    "Manee Rukdee",

    // Company accounts
    "Cats N Cards TCG",
    "Cats N Cards Trading Card Game",
    "บริษัท แมวการ์ดเกม จำกัด",

    // Alternative spellings that might appear
    "สมชัย ใจดี", // Common alternative spelling
    "น.สมชาย ใจดี", // With title abbreviation
    "สมชาย จ.", // Abbreviated surname

    // Add more recipient names as needed
    // "Example Name",
    // "Another Recipient",
];

/**
 * Payment verification configuration
 * These settings control how strict the recipient name verification should be
 */
const VERIFICATION_CONFIG = {
    // Enable/disable recipient name verification
    ENABLE_RECIPIENT_VERIFICATION: true,

    // How strict the matching should be:
    // "exact" - must match exactly
    // "contains" - recipient name must contain the bank statement name
    // "partial" - partial matching allowed (less strict)
    MATCHING_MODE: "contains",

    // Minimum similarity percentage for partial matching (0-100)
    MIN_SIMILARITY: 70,

    // Case sensitive matching (true = exact case, false = case insensitive)
    CASE_SENSITIVE: false,

    // Ignore common titles and prefixes
    IGNORE_TITLES: ["นาย", "นาง", "นางสาว", "น.", "น.ส.", "Mr.", "Mrs.", "Ms.", "Dr."],

    // Allow partial payment verification
    // If true, will verify payments that are >= expected amount
    ALLOW_OVERPAYMENT: true,

    // Delivery fee configuration
    DELIVERY_FEE: {
        amount: 50, // Fixed delivery fee in THB
        tolerance: 5, // Acceptable variance in THB
    }
};

/**
 * Helper function to normalize names for comparison
 * Removes titles, extra spaces, and standardizes formatting
 */
function normalizeRecipientName(name) {
    if (!name) return "";

    let normalized = name.trim();

    // Remove titles and prefixes
    VERIFICATION_CONFIG.IGNORE_TITLES.forEach(title => {
        const titleRegex = new RegExp(`^${title}\\s*`, 'i');
        normalized = normalized.replace(titleRegex, '');
    });

    // Remove extra spaces and convert to consistent case
    normalized = normalized.replace(/\s+/g, ' ');

    if (!VERIFICATION_CONFIG.CASE_SENSITIVE) {
        normalized = normalized.toLowerCase();
    }

    return normalized.trim();
}

/**
 * Check if a recipient name is valid
 * @param {string} recipientName - Name to verify from payment slip
 * @returns {boolean} - True if name is valid
 */
function isValidRecipient(recipientName) {
    if (!VERIFICATION_CONFIG.ENABLE_RECIPIENT_VERIFICATION) {
        return true; // Skip verification if disabled
    }

    if (!recipientName) {
        return false;
    }

    const normalizedInput = normalizeRecipientName(recipientName);

    return RECIPIENT_NAMES.some(validName => {
        const normalizedValid = normalizeRecipientName(validName);

        switch (VERIFICATION_CONFIG.MATCHING_MODE) {
            case "exact":
                return normalizedInput === normalizedValid;
            case "contains":
                return normalizedInput.includes(normalizedValid) ||
                       normalizedValid.includes(normalizedInput);
            case "partial":
                // Simple partial matching - could be enhanced with more sophisticated algorithms
                return normalizedInput.includes(normalizedValid.substring(0, 3));
            default:
                return false;
        }
    });
}

/**
 * Get all valid recipient names (for debugging/testing)
 * @returns {Array} - Array of valid recipient names
 */
function getAllValidRecipients() {
    return [...RECIPIENT_NAMES];
}

/**
 * Add a new recipient name to the valid list
 * @param {string} newName - New recipient name to add
 */
function addRecipientName(newName) {
    if (newName && !RECIPIENT_NAMES.includes(newName)) {
        RECIPIENT_NAMES.push(newName);
        console.log(`Added new recipient: ${newName}`);
    }
}

/**
 * Remove a recipient name from the valid list
 * @param {string} nameToRemove - Recipient name to remove
 */
function removeRecipientName(nameToRemove) {
    const index = RECIPIENT_NAMES.indexOf(nameToRemove);
    if (index > -1) {
        RECIPIENT_NAMES.splice(index, 1);
        console.log(`Removed recipient: ${nameToRemove}`);
    }
}

// Export functions and configuration for use in other scripts
if (typeof window !== 'undefined') {
    // Browser environment
    window.RECIPIENT_NAMES = RECIPIENT_NAMES;
    window.VERIFICATION_CONFIG = VERIFICATION_CONFIG;
    window.isValidRecipient = isValidRecipient;
    window.normalizeRecipientName = normalizeRecipientName;
    window.getAllValidRecipients = getAllValidRecipients;
    window.addRecipientName = addRecipientName;
    window.removeRecipientName = removeRecipientName;
} else if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        RECIPIENT_NAMES,
        VERIFICATION_CONFIG,
        isValidRecipient,
        normalizeRecipientName,
        getAllValidRecipients,
        addRecipientName,
        removeRecipientName
    };
}

// Console log for debugging
console.log('[Recipient Names] Configuration loaded with', RECIPIENT_NAMES.length, 'valid recipients');