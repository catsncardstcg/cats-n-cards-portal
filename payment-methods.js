/**
 * Payment Methods Management for Cats N Cards Portal
 * Handles QR code management for multiple payment accounts
 */

// Global variables
let db;
let paymentMethods = [];
let currentPaymentMethod = null;

// Payment method types
const PAYMENT_TYPES = {
    PROMPTPAY: 'promptpay',
    BANK_TRANSFER: 'bank_transfer',
    TRUE_WALLET: 'true_wallet',
    LINE_PAY: 'line_pay',
    OTHER: 'other'
};

// Initialize payment methods when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[PaymentMethods] Initializing...');

    // Initialize Firebase if needed
    if (typeof initializeFirebase === 'function') {
        initializeFirebase();
    }

    // Wait for Firebase to be ready
    const initCheck = setInterval(() => {
        if (typeof isFirestoreReady === 'function' && isFirestoreReady()) {
            clearInterval(initCheck);
            initializePaymentMethods();
        }
    }, 100);

    // Fallback timeout
    setTimeout(() => {
        if (typeof isFirestoreReady !== 'function' || !isFirestoreReady()) {
            console.error('[PaymentMethods] Firebase initialization timeout');
            showPaymentMethodsError('Failed to initialize Firebase. Please refresh the page.');
        }
    }, 5000);
});

/**
 * Initialize payment methods system
 */
function initializePaymentMethods() {
    console.log('[PaymentMethods] Firebase ready, initializing payment methods...');

    // Get Firestore instance
    db = getFirebaseFirestore();

    if (!db) {
        console.error('[PaymentMethods] Failed to get Firestore instance');
        showPaymentMethodsError('Failed to connect to database. Please refresh the page.');
        return;
    }

    console.log('[PaymentMethods] Connected to Firestore successfully');

    // Load payment methods
    loadPaymentMethods();

    console.log('[PaymentMethods] Payment methods initialized successfully');
}

/**
 * Load all payment methods from Firestore
 */
async function loadPaymentMethods() {
    try {
        console.log('[PaymentMethods] Loading payment methods...');

        const snapshot = await db.collection('paymentMethods')
            .where('isActive', '==', true)
            .orderBy('displayOrder', 'asc')
            .get();

        paymentMethods = [];
        snapshot.forEach(doc => {
            paymentMethods.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`[PaymentMethods] Loaded ${paymentMethods.length} active payment methods`);

        // Set current payment method to first active one
        if (paymentMethods.length > 0) {
            currentPaymentMethod = paymentMethods[0];
        }

        // Update UI
        updatePaymentMethodsUI();

    } catch (error) {
        console.error('[PaymentMethods] Error loading payment methods:', error);
        showPaymentMethodsError('Failed to load payment methods. Please try again.');
    }
}

/**
 * Get all active payment methods
 * @returns {Array} Array of active payment methods
 */
function getActivePaymentMethods() {
    return paymentMethods.filter(method => method.isActive);
}

/**
 * Get current payment method
 * @returns {Object|null} Current payment method or null
 */
function getCurrentPaymentMethod() {
    return currentPaymentMethod;
}

/**
 * Set current payment method by ID
 * @param {string} paymentMethodId - ID of the payment method to set as current
 */
function setCurrentPaymentMethod(paymentMethodId) {
    const method = paymentMethods.find(m => m.id === paymentMethodId);
    if (method) {
        currentPaymentMethod = method;
        console.log('[PaymentMethods] Current payment method set to:', method.name);
        updatePaymentMethodsUI();
        return true;
    }
    return false;
}

/**
 * Create a new payment method
 * @param {Object} paymentMethodData - Payment method data
 * @returns {Promise} Promise that resolves when payment method is created
 */
async function createPaymentMethod(paymentMethodData) {
    try {
        console.log('[PaymentMethods] Creating new payment method:', paymentMethodData.name);

        // Generate unique ID
        const paymentMethodId = db.collection('paymentMethods').doc().id;

        // Create payment method document
        const newPaymentMethod = {
            id: paymentMethodId,
            name: paymentMethodData.name,
            type: paymentMethodData.type || PAYMENT_TYPES.PROMPTPAY,
            isActive: paymentMethodData.isActive !== false,
            displayOrder: paymentMethodData.displayOrder || 0,
            description: paymentMethodData.description || '',
            accountNumber: paymentMethodData.accountNumber || '',
            accountName: paymentMethodData.accountName || '',
            imageUrl: paymentMethodData.imageUrl || '',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: paymentMethodData.createdBy || 'admin'
        };

        await db.collection('paymentMethods').doc(paymentMethodId).set(newPaymentMethod);

        // Update local array
        paymentMethods.push(newPaymentMethod);

        console.log('[PaymentMethods] Payment method created successfully:', paymentMethodId);

        // Update UI
        updatePaymentMethodsUI();

        return { success: true, id: paymentMethodId };

    } catch (error) {
        console.error('[PaymentMethods] Error creating payment method:', error);
        throw new Error('Failed to create payment method: ' + error.message);
    }
}

/**
 * Update an existing payment method
 * @param {string} paymentMethodId - ID of the payment method to update
 * @param {Object} updateData - Data to update
 * @returns {Promise} Promise that resolves when payment method is updated
 */
async function updatePaymentMethod(paymentMethodId, updateData) {
    try {
        console.log('[PaymentMethods] Updating payment method:', paymentMethodId);

        // Prepare update data
        const updateDoc = {
            ...updateData,
            updatedAt: new Date()
        };

        // Update in Firestore
        await db.collection('paymentMethods').doc(paymentMethodId).update(updateDoc);

        // Update local array
        const index = paymentMethods.findIndex(m => m.id === paymentMethodId);
        if (index !== -1) {
            paymentMethods[index] = { ...paymentMethods[index], ...updateDoc };
        }

        // Update current payment method if it was updated
        if (currentPaymentMethod && currentPaymentMethod.id === paymentMethodId) {
            currentPaymentMethod = { ...currentPaymentMethod, ...updateDoc };
        }

        console.log('[PaymentMethods] Payment method updated successfully');

        // Update UI
        updatePaymentMethodsUI();

        return { success: true };

    } catch (error) {
        console.error('[PaymentMethods] Error updating payment method:', error);
        throw new Error('Failed to update payment method: ' + error.message);
    }
}

/**
 * Delete a payment method
 * @param {string} paymentMethodId - ID of the payment method to delete
 * @returns {Promise} Promise that resolves when payment method is deleted
 */
async function deletePaymentMethod(paymentMethodId) {
    try {
        console.log('[PaymentMethods] Deleting payment method:', paymentMethodId);

        // Delete from Firestore
        await db.collection('paymentMethods').doc(paymentMethodId).delete();

        // Remove from local array
        paymentMethods = paymentMethods.filter(m => m.id !== paymentMethodId);

        // Update current payment method if it was deleted
        if (currentPaymentMethod && currentPaymentMethod.id === paymentMethodId) {
            currentPaymentMethod = paymentMethods.length > 0 ? paymentMethods[0] : null;
        }

        console.log('[PaymentMethods] Payment method deleted successfully');

        // Update UI
        updatePaymentMethodsUI();

        return { success: true };

    } catch (error) {
        console.error('[PaymentMethods] Error deleting payment method:', error);
        throw new Error('Failed to delete payment method: ' + error.message);
    }
}

/**
 * Upload QR code image to Firebase Storage
 * @param {File} file - Image file to upload
 * @param {string} paymentMethodId - ID of the payment method
 * @returns {Promise} Promise that resolves with download URL
 */
async function uploadQRCode(file, paymentMethodId) {
    try {
        console.log('[PaymentMethods] Uploading QR code for payment method:', paymentMethodId);

        const storage = getFirebaseStorage();
        if (!storage) {
            throw new Error('Firebase Storage is not initialized');
        }

        // Create storage reference
        const storageRef = storage.ref();
        const qrCodeRef = storageRef.child(`payment-methods/${paymentMethodId}/qr-code.png`);

        // Upload file
        const snapshot = await qrCodeRef.put(file);

        // Get download URL
        const downloadURL = await snapshot.ref.getDownloadURL();

        console.log('[PaymentMethods] QR code uploaded successfully:', downloadURL);

        return downloadURL;

    } catch (error) {
        console.error('[PaymentMethods] Error uploading QR code:', error);
        throw new Error('Failed to upload QR code: ' + error.message);
    }
}

/**
 * Update payment methods UI on payment page
 */
function updatePaymentMethodsUI() {
    if (!paymentMethods.length) {
        console.log('[PaymentMethods] No payment methods to display');
        return;
    }

    // Update QR code display on payment page
    const qrSection = document.querySelector('.qr-section');
    if (qrSection) {
        updateQRCodeDisplay(qrSection);
    }

    // Update payment method selector if it exists
    const selector = document.getElementById('payment-method-selector');
    if (selector) {
        updatePaymentMethodSelector(selector);
    }

    console.log('[PaymentMethods] UI updated successfully');
}

/**
 * Update QR code display on payment page
 * @param {HTMLElement} qrSection - QR section element
 */
function updateQRCodeDisplay(qrSection) {
    if (!currentPaymentMethod) {
        console.warn('[PaymentMethods] No current payment method selected');
        return;
    }

    // Update QR code image
    const qrImage = qrSection.querySelector('img');
    if (qrImage) {
        qrImage.src = currentPaymentMethod.imageUrl || 'qr.png';
        qrImage.alt = `${currentPaymentMethod.name} QR Code`;
    }

    // Update payment method description
    const description = qrSection.querySelector('p');
    if (description && currentPaymentMethod.description) {
        description.textContent = currentPaymentMethod.description;
    }

    console.log('[PaymentMethods] QR code display updated:', currentPaymentMethod.name);
}

/**
 * Update payment method selector
 * @param {HTMLElement} selector - Selector element
 */
function updatePaymentMethodSelector(selector) {
    const activeMethods = getActivePaymentMethods();

    // Clear existing options
    selector.innerHTML = '';

    // Add options for each active payment method
    activeMethods.forEach(method => {
        const option = document.createElement('option');
        option.value = method.id;
        option.textContent = method.name;
        option.selected = currentPaymentMethod && currentPaymentMethod.id === method.id;
        selector.appendChild(option);
    });

    // Add change event listener
    selector.addEventListener('change', (e) => {
        setCurrentPaymentMethod(e.target.value);
    });

    console.log('[PaymentMethods] Payment method selector updated');
}

/**
 * Show payment methods error
 * @param {string} message - Error message
 */
function showPaymentMethodsError(message) {
    console.error('[PaymentMethods] Error:', message);

    // Show error alert if it exists
    const alert = document.getElementById('payment-methods-alert');
    if (alert) {
        alert.textContent = message;
        alert.className = 'alert error show';

        setTimeout(() => {
            alert.classList.remove('show');
        }, 5000);
    }
}

// Export functions for use in other modules
if (typeof window !== 'undefined') {
    window.PaymentMethods = {
        createPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        uploadQRCode,
        getActivePaymentMethods,
        getCurrentPaymentMethod,
        setCurrentPaymentMethod,
        PAYMENT_TYPES
    };
}

console.log('[PaymentMethods] Payment methods module loaded');