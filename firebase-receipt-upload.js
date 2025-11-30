/**
 * Firebase Receipt Upload Module
 * Handles uploading receipt images to Firebase Storage with compression
 */

// Configuration
const USE_FIREBASE_STORAGE = true;
const FALLBACK_TO_APPS_SCRIPT = true;

// Apps Script URL for fallback
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwCqZ_e1xU4UJ5xCOy1jQcaokVd4WdyN3Eq4Z3wR6r3qJ0R62Vkg_FdXHkSlCp7gKHFkg/exec';

/**
 * Upload receipt image to Firebase Storage
 * @param {File} imageFile - The image file to upload
 * @param {string} tiktokUsername - User's TikTok username
 * @param {string} uploadType - Type of upload ('payment' or 'delivery')
 * @param {Object} metadata - Additional metadata (amount, lineUserId, etc.)
 * @param {Function} progressCallback - Optional progress callback (percentage)
 * @returns {Promise<Object>} Upload result with URL and metadata
 */
async function uploadReceiptToFirebase(imageFile, tiktokUsername, uploadType, metadata = {}, progressCallback = null) {
    console.log('[Receipt Upload] Starting Firebase Storage upload...');
    console.log('[Receipt Upload] File:', imageFile.name, 'Size:', imageFile.size, 'Type:', imageFile.type);
    console.log('[Receipt Upload] Upload type:', uploadType);
    console.log('[Receipt Upload] Metadata:', metadata);

    try {
        // Wait for Firebase Storage to be ready
        console.log('[Receipt Upload] Waiting for Firebase Storage...');
        for (let i = 0; i < 30; i++) {
            if (typeof getFirebaseStorage === 'function' && isStorageReady()) {
                console.log('[Receipt Upload] ✅ Firebase Storage ready!');
                break;
            }
            console.log(`[Receipt Upload] Waiting... (${i * 100}ms)`);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Check if Storage is available
        if (!USE_FIREBASE_STORAGE || typeof getFirebaseStorage !== 'function' || !isStorageReady()) {
            console.warn('[Receipt Upload] Firebase Storage not available, using fallback');
            if (FALLBACK_TO_APPS_SCRIPT) {
                return await uploadReceiptToAppsScript(imageFile, tiktokUsername, uploadType, metadata, progressCallback);
            } else {
                throw new Error('Firebase Storage not available and fallback disabled');
            }
        }

        const storage = getFirebaseStorage();
        const firestore = getFirebaseFirestore();

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedUsername = tiktokUsername.replace(/[^a-zA-Z0-9]/g, '_');
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${uploadType}_${sanitizedUsername}_${timestamp}.${fileExt}`;
        const storagePath = `receipts/${uploadType}/${sanitizedUsername}/${fileName}`;

        console.log('[Receipt Upload] Uploading to:', storagePath);

        // Create storage reference
        const storageRef = storage.ref(storagePath);

        // Start upload
        const uploadTask = storageRef.put(imageFile, {
            contentType: imageFile.type,
            customMetadata: {
                tiktokUsername: tiktokUsername,
                uploadType: uploadType,
                lineUserId: metadata.lineUserId || '',
                uploadedAt: new Date().toISOString()
            }
        });

        // Monitor upload progress
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('[Receipt Upload] Progress:', Math.round(progress) + '%');
                if (progressCallback) {
                    progressCallback(Math.round(progress));
                }
            },
            (error) => {
                console.error('[Receipt Upload] Upload error:', error);
                throw error;
            }
        );

        // Wait for upload to complete
        const snapshot = await uploadTask;
        console.log('[Receipt Upload] ✅ Upload complete!');

        // Get download URL
        const downloadURL = await snapshot.ref.getDownloadURL();
        console.log('[Receipt Upload] Download URL:', downloadURL);

        // Save metadata to Firestore
        if (firestore && typeof isFirestoreReady === 'function' && isFirestoreReady()) {
            console.log('[Receipt Upload] Saving metadata to Firestore...');
            const receiptData = {
                tiktokUsername: tiktokUsername,
                lineUserId: metadata.lineUserId || '',
                lineDisplayName: metadata.lineDisplayName || '',
                uploadType: uploadType,
                fileName: fileName,
                storagePath: storagePath,
                downloadURL: downloadURL,
                fileSize: imageFile.size,
                fileType: imageFile.type,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
                amount: metadata.amount || null,
                preset: metadata.preset || null,
                status: 'pending', // pending, verified, rejected
                verifiedAt: null,
                verifiedBy: null
            };

            const docRef = await firestore.collection('receipts').add(receiptData);
            console.log('[Receipt Upload] ✅ Metadata saved with ID:', docRef.id);

            return {
                success: true,
                receiptId: docRef.id,
                downloadURL: downloadURL,
                storagePath: storagePath,
                message: 'Receipt uploaded successfully to Firebase Storage'
            };
        } else {
            console.warn('[Receipt Upload] Firestore not available, skipping metadata save');
            return {
                success: true,
                downloadURL: downloadURL,
                storagePath: storagePath,
                message: 'Receipt uploaded to Firebase Storage (metadata not saved)'
            };
        }

    } catch (error) {
        console.error('[Receipt Upload] Firebase upload failed:', error);

        // Fallback to Apps Script if enabled
        if (FALLBACK_TO_APPS_SCRIPT) {
            console.log('[Receipt Upload] Falling back to Google Apps Script...');
            return await uploadReceiptToAppsScript(imageFile, tiktokUsername, uploadType, metadata, progressCallback);
        } else {
            throw error;
        }
    }
}

/**
 * Fallback: Upload to Google Apps Script (existing method)
 * @param {File} imageFile - The image file to upload
 * @param {string} tiktokUsername - User's TikTok username
 * @param {string} uploadType - Type of upload ('payment' or 'delivery')
 * @param {Object} metadata - Additional metadata
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<Object>} Upload result
 */
async function uploadReceiptToAppsScript(imageFile, tiktokUsername, uploadType, metadata, progressCallback) {
    console.log('[Receipt Upload] Using Google Apps Script fallback');

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const base64Image = e.target.result.split(',')[1];

                const formData = {
                    action: 'uploadReceipt',
                    imageData: base64Image,
                    tiktokUsername: tiktokUsername,
                    uploadType: uploadType,
                    ...metadata
                };

                if (progressCallback) {
                    progressCallback(50); // Simulated progress
                }

                const response = await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify(formData),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (progressCallback) {
                    progressCallback(100);
                }

                const result = await response.json();

                if (result.success) {
                    console.log('[Receipt Upload] ✅ Apps Script upload successful');
                    resolve(result);
                } else {
                    console.error('[Receipt Upload] Apps Script upload failed:', result.message);
                    reject(new Error(result.message || 'Apps Script upload failed'));
                }
            } catch (error) {
                console.error('[Receipt Upload] Apps Script error:', error);
                reject(error);
            }
        };

        reader.onerror = function(error) {
            console.error('[Receipt Upload] FileReader error:', error);
            reject(error);
        };

        reader.readAsDataURL(imageFile);
    });
}
