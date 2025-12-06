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

// Helper function to test Thunder API (for debugging)
exports.testThunderAPI = functions.https.onRequest(async (req, res) => {
  // This is for testing purposes only
  res.send({
    message: 'Thunder API test endpoint',
    status: 'Ready',
    auth: 'Configured'
  });
});