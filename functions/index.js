const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { verifyWithThunderAPI } = require('./thunder-api');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Cloud Function to verify receipts with Thunder API
exports.verifyReceipt = functions.firestore
  .document('receipts/{receiptId}')
  .onCreate(async (snap, context) => {
    const receipt = snap.data();
    console.log('[Cloud Function] Starting verification for receipt:', context.params.receiptId);

    try {
      // 1. Mark as verifying
      await snap.ref.update({
        status: 'verifying',
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('[Cloud Function] Marked as verifying');

      // 2. Download image from Firebase Storage
      const imageBuffer = await downloadImageFromStorage(receipt.storagePath);
      console.log('[Cloud Function] Downloaded image from Storage');

      // 3. Call Thunder API with image
      const verification = await verifyWithThunderAPI(imageBuffer);
      console.log('[Cloud Function] Thunder API response:', verification);

      // 4. Update with result
      const isVerified = verification.status === 200;
      await snap.ref.update({
        status: isVerified ? 'verified' : 'failed',
        thunderResult: verification.data,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 5. Log successful verification
      if (isVerified) {
        console.log('[Cloud Function] ✅ Transaction verified:', verification.data.data?.transRef);
        console.log('[Cloud Function] Amount:', verification.data.data?.amount?.amount);
        console.log('[Cloud Function] Sender:', verification.data.data?.sender?.account?.name?.en);
      } else {
        console.log('[Cloud Function] ❌ Transaction verification failed');
      }

    } catch (error) {
      console.error('[Cloud Function] Error during verification:', error);
      await snap.ref.update({
        status: 'error',
        error: error.message,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });

// Helper function to download image from Firebase Storage
async function downloadImageFromStorage(storagePath) {
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  const [imageBuffer] = await file.download();
  return imageBuffer;
}

// Cloud Function to create payment method
exports.createPaymentMethod = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  try {
    const { name, type, description, accountNumber, accountName, imageUrl, displayOrder } = data;

    // Validate required fields
    if (!name || !type) {
      throw new functions.https.HttpsError('invalid-argument', 'Name and type are required');
    }

    // Create payment method document
    const paymentMethodRef = admin.firestore().collection('paymentMethods').doc();
    const paymentMethodData = {
      name: name.trim(),
      type: type,
      description: description ? description.trim() : '',
      accountNumber: accountNumber ? accountNumber.trim() : '',
      accountName: accountName ? accountName.trim() : '',
      imageUrl: imageUrl || '',
      displayOrder: displayOrder || 0,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.uid
    };

    await paymentMethodRef.set(paymentMethodData);

    console.log('[Cloud Function] Payment method created:', paymentMethodRef.id);

    return {
      success: true,
      id: paymentMethodRef.id,
      data: paymentMethodData
    };

  } catch (error) {
    console.error('[Cloud Function] Error creating payment method:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create payment method: ' + error.message);
  }
});

// Cloud Function to update payment method
exports.updatePaymentMethod = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  try {
    const { paymentMethodId, updateData } = data;

    if (!paymentMethodId) {
      throw new functions.https.HttpsError('invalid-argument', 'Payment method ID is required');
    }

    // Check if payment method exists
    const paymentMethodRef = admin.firestore().collection('paymentMethods').doc(paymentMethodId);
    const doc = await paymentMethodRef.get();

    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payment method not found');
    }

    // Prepare update data
    const updateDoc = {
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid
    };

    // Update payment method
    await paymentMethodRef.update(updateDoc);

    console.log('[Cloud Function] Payment method updated:', paymentMethodId);

    return {
      success: true,
      id: paymentMethodId
    };

  } catch (error) {
    console.error('[Cloud Function] Error updating payment method:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update payment method: ' + error.message);
  }
});

// Cloud Function to delete payment method
exports.deletePaymentMethod = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  try {
    const { paymentMethodId } = data;

    if (!paymentMethodId) {
      throw new functions.https.HttpsError('invalid-argument', 'Payment method ID is required');
    }

    // Check if payment method exists
    const paymentMethodRef = admin.firestore().collection('paymentMethods').doc(paymentMethodId);
    const doc = await paymentMethodRef.get();

    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payment method not found');
    }

    // Delete payment method
    await paymentMethodRef.delete();

    console.log('[Cloud Function] Payment method deleted:', paymentMethodId);

    return {
      success: true,
      id: paymentMethodId
    };

  } catch (error) {
    console.error('[Cloud Function] Error deleting payment method:', error);
    throw new functions.https.HttpsError('internal', 'Failed to delete payment method: ' + error.message);
  }
});

// Cloud Function to get active payment methods
exports.getActivePaymentMethods = functions.https.onCall(async (data, context) => {
  try {
    const snapshot = await admin.firestore()
      .collection('paymentMethods')
      .where('isActive', '==', true)
      .orderBy('displayOrder', 'asc')
      .get();

    const paymentMethods = [];
    snapshot.forEach(doc => {
      paymentMethods.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log('[Cloud Function] Retrieved payment methods:', paymentMethods.length);

    return {
      success: true,
      data: paymentMethods
    };

  } catch (error) {
    console.error('[Cloud Function] Error getting payment methods:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get payment methods: ' + error.message);
  }
});

// HTTP endpoint to get payment methods (for public access)
exports.getPaymentMethods = functions.https.onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Get only active payment methods for public access
    const snapshot = await admin.firestore()
      .collection('paymentMethods')
      .where('isActive', '==', true)
      .orderBy('displayOrder', 'asc')
      .get();

    const paymentMethods = [];
    snapshot.forEach(doc => {
      const method = doc.data();
      // Only include necessary fields for public access
      paymentMethods.push({
        id: doc.id,
        name: method.name,
        type: method.type,
        description: method.description,
        imageUrl: method.imageUrl,
        displayOrder: method.displayOrder || 0
      });
    });

    res.json({
      success: true,
      data: paymentMethods
    });

  } catch (error) {
    console.error('[Cloud Function] Error getting payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment methods: ' + error.message
    });
  }
});

// Helper function to test Thunder API (for debugging)
exports.testThunderAPI = functions.https.onRequest(async (req, res) => {
  // This is for testing purposes only
  res.send({
    message: 'Thunder API test endpoint',
    status: 'Ready',
    auth: 'Configured'
  });
});

// Export LINE webhook
exports.lineWebhook = require('./src/lineWebhook').lineWebhook;
exports.lineWebhookSimple = require('./src/lineWebhook-simple').lineWebhookSimple;
exports.lineWebhookMinimal = require('./src/lineWebhook-minimal').lineWebhookMinimal;