/**
 * Image Compression Utilities for Cats N Cards Portal
 * Handles image validation, compression, and Base64 conversion
 *
 * Requires: browser-image-compression library
 * CDN: https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Change this to 1, 2, or 3 to test different compression levels
const ACTIVE_PRESET = 3;

// Compression presets for testing
const COMPRESSION_PRESETS = {
    1: { // Conservative - safest quality
        receipt: {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1200,
            initialQuality: 0.8,
            useWebWorker: true,
            fileType: 'image/jpeg'
        },
        screenshot: {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1080,
            initialQuality: 0.75,
            useWebWorker: true,
            fileType: 'image/jpeg'
        }
    },
    2: { // Balanced - more compression
        receipt: {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 900,
            initialQuality: 0.7,
            useWebWorker: true,
            fileType: 'image/jpeg'
        },
        screenshot: {
            maxSizeMB: 0.2,
            maxWidthOrHeight: 800,
            initialQuality: 0.65,
            useWebWorker: true,
            fileType: 'image/jpeg'
        }
    },
    3: { // Maximum - smallest files
        receipt: {
            maxSizeMB: 0.2,
            maxWidthOrHeight: 720,
            initialQuality: 0.6,
            useWebWorker: true,
            fileType: 'image/jpeg'
        },
        screenshot: {
            maxSizeMB: 0.15,
            maxWidthOrHeight: 720,
            initialQuality: 0.6,
            useWebWorker: true,
            fileType: 'image/jpeg'
        }
    }
};

// Validation configuration
const VALIDATION_CONFIG = {
    maxOriginalSizeMB: 20,
    maxCompressedSizeMB: 2,
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'],
    compressionThresholdMB: 0.5  // Only compress files larger than 500KB
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format file size in bytes to human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "2.5 MB")
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Update progress bar width
 * @param {string} progressBarId - ID of progress bar fill element
 * @param {number} percent - Progress percentage (0-100)
 */
function updateProgressBar(progressBarId, percent) {
    const progressBar = document.getElementById(progressBarId);
    if (progressBar) {
        progressBar.style.width = Math.min(100, Math.max(0, percent)) + '%';
    }
}

/**
 * Update progress text message
 * @param {string} statusTextId - ID of status text element
 * @param {string} message - Message to display
 */
function updateStatusText(statusTextId, message) {
    const statusText = document.getElementById(statusTextId);
    if (statusText) {
        statusText.textContent = message;
    }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate image file before compression
 * @param {File} file - File object to validate
 * @returns {Object} Validation result { valid: boolean, error: string }
 */
function validateImageFile(file) {
    // Check if file exists
    if (!file) {
        return {
            valid: false,
            error: 'ไม่พบไฟล์ กรุณาเลือกรูปภาพ / No file selected. Please select an image'
        };
    }

    // Check file type
    if (!VALIDATION_CONFIG.allowedMimeTypes.includes(file.type)) {
        return {
            valid: false,
            error: `ประเภทไฟล์ไม่ถูกต้อง (${file.type}) กรุณาเลือก JPG, PNG, หรือ WebP / Invalid file type (${file.type}). Please select JPG, PNG, or WebP`
        };
    }

    // Check file size
    const fileSizeMB = file.size / 1024 / 1024;
    if (fileSizeMB > VALIDATION_CONFIG.maxOriginalSizeMB) {
        return {
            valid: false,
            error: `ไฟล์ใหญ่เกินไป (${fileSizeMB.toFixed(1)} MB) กรุณาเลือกไฟล์ที่เล็กกว่า ${VALIDATION_CONFIG.maxOriginalSizeMB} MB / File too large (${fileSizeMB.toFixed(1)} MB). Please select file smaller than ${VALIDATION_CONFIG.maxOriginalSizeMB} MB`
        };
    }

    return { valid: true, error: null };
}

// ============================================================================
// COMPRESSION
// ============================================================================

/**
 * Compress image using browser-image-compression library
 * @param {File} file - File object to compress
 * @param {string} presetType - Type of preset ('receipt' or 'screenshot')
 * @param {Function} onProgress - Progress callback function (optional)
 * @returns {Promise<File>} Compressed file
 */
async function compressImage(file, presetType, onProgress) {
    try {
        // Check if imageCompression is available
        if (typeof imageCompression === 'undefined') {
            throw new Error('Image compression library not loaded');
        }

        // Get compression preset
        const preset = COMPRESSION_PRESETS[ACTIVE_PRESET][presetType];
        if (!preset) {
            throw new Error(`Invalid preset type: ${presetType}`);
        }

        console.log('[ImageCompression] Starting compression with preset:', ACTIVE_PRESET, presetType, preset);
        console.log('[ImageCompression] Original file size:', formatFileSize(file.size));

        // Compress image
        const compressedFile = await imageCompression(file, {
            ...preset,
            onProgress: onProgress || undefined
        });

        console.log('[ImageCompression] Compressed file size:', formatFileSize(compressedFile.size));
        console.log('[ImageCompression] Compression ratio:', ((1 - compressedFile.size / file.size) * 100).toFixed(1) + '%');

        // Verify compressed file size
        const compressedSizeMB = compressedFile.size / 1024 / 1024;
        if (compressedSizeMB > VALIDATION_CONFIG.maxCompressedSizeMB) {
            console.warn('[ImageCompression] Compressed file still too large:', compressedSizeMB.toFixed(2), 'MB');
            throw new Error(`ไฟล์ยังใหญ่เกินไปหลังบีบอัด (${compressedSizeMB.toFixed(1)} MB) กรุณาถ่ายรูปใหม่หรือเลือกไฟล์อื่น / File still too large after compression (${compressedSizeMB.toFixed(1)} MB). Please take a new photo`);
        }

        return compressedFile;
    } catch (error) {
        console.error('[ImageCompression] Compression error:', error);
        throw new Error(`ไม่สามารถบีบอัดรูปภาพได้: ${error.message} / Failed to compress image: ${error.message}`);
    }
}

// ============================================================================
// BASE64 CONVERSION
// ============================================================================

/**
 * Convert file to Base64 string (async)
 * @param {File|Blob} file - File or Blob to convert
 * @returns {Promise<string>} Base64 string (without data URL prefix)
 */
async function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                // Extract base64 data (remove "data:image/jpeg;base64," prefix)
                const base64 = e.target.result.split(',')[1];
                resolve(base64);
            } catch (error) {
                reject(new Error('Failed to extract Base64 data'));
            }
        };

        reader.onerror = () => {
            reject(new Error('FileReader error: ' + reader.error));
        };

        reader.readAsDataURL(file);
    });
}

// ============================================================================
// HIGH-LEVEL PROCESSING FUNCTION
// ============================================================================

/**
 * Process image for upload: validate → compress → convert to Base64
 * @param {File} file - File object to process
 * @param {string} presetType - Type of preset ('receipt' or 'screenshot')
 * @param {Object} uiElements - UI element IDs { progressBar, statusText }
 * @returns {Promise<Object>} Result object { base64, stats: { originalSize, compressedSize, compressionRatio } }
 */
async function processImageForUpload(file, presetType, uiElements = {}) {
    const { progressBar, statusText } = uiElements;

    try {
        // Step 1: Validate file (0-10%)
        updateProgressBar(progressBar, 5);
        updateStatusText(statusText, 'Validating file... / กำลังตรวจสอบไฟล์...');

        const validation = validateImageFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        updateProgressBar(progressBar, 10);

        // Check file size - skip compression for small files
        const fileSizeMB = file.size / 1024 / 1024;
        const shouldCompress = fileSizeMB > VALIDATION_CONFIG.compressionThresholdMB;

        let finalFile = file;
        let compressionRatio = '0%';

        if (shouldCompress) {
            // Step 2: Compress image (10-70%)
            updateStatusText(statusText, `Compressing image (Preset ${ACTIVE_PRESET})... / กำลังบีบอัดรูปภาพ...`);

            finalFile = await compressImage(file, presetType, (progress) => {
                // Map compression progress (0-100) to our progress range (10-70)
                const mappedProgress = 10 + (progress * 0.6);
                updateProgressBar(progressBar, mappedProgress);
            });

            compressionRatio = ((1 - finalFile.size / file.size) * 100).toFixed(1) + '%';
            console.log('[ImageCompression] File compressed');
            console.log('[ImageCompression] Original:', formatFileSize(file.size));
            console.log('[ImageCompression] Compressed:', formatFileSize(finalFile.size));
            console.log('[ImageCompression] Reduction:', compressionRatio);
        } else {
            // Skip compression - file already small
            console.log('[ImageCompression] File already small (' + formatFileSize(file.size) + '), skipping compression');
            updateStatusText(statusText, 'File already optimized, skipping compression... / ไฟล์เหมาะสมแล้ว ข้ามการบีบอัด...');
        }

        updateProgressBar(progressBar, 70);

        // Step 3: Convert to Base64 (70-80%)
        updateStatusText(statusText, 'Converting to upload format... / กำลังแปลงไฟล์...');

        const base64 = await readFileAsBase64(finalFile);

        updateProgressBar(progressBar, 80);

        // Calculate stats
        const originalSize = file.size;
        const compressedSize = finalFile.size;

        console.log('[ImageCompression] Processing complete');

        return {
            base64: base64,
            stats: {
                originalSize: originalSize,
                compressedSize: compressedSize,
                compressionRatio: compressionRatio,
                originalSizeFormatted: formatFileSize(originalSize),
                compressedSizeFormatted: formatFileSize(compressedSize),
                skippedCompression: !shouldCompress
            }
        };
    } catch (error) {
        console.error('[ImageCompression] Processing error:', error);
        // Re-throw with original error message (already bilingual)
        throw error;
    }
}

// ============================================================================
// EXPORTS (for module systems)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateImageFile,
        compressImage,
        readFileAsBase64,
        processImageForUpload,
        formatFileSize,
        updateProgressBar,
        updateStatusText,
        ACTIVE_PRESET,
        COMPRESSION_PRESETS,
        VALIDATION_CONFIG
    };
}

console.log('[ImageCompression] Utilities loaded successfully - Active Preset:', ACTIVE_PRESET);
