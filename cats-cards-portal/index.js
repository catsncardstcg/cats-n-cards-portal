const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {verifyWithThunderAPI} = require("./thunder-api");

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Cloud Function to verify receipts with Thunder API
 * @param {functions.Change} snap - Document snapshot
 * @param {functions.EventContext} context - Event context
 * @returns {Promise} - Verification result
 */
exports.verifyReceipt = functions
    .region("asia-southeast1")
    .runWith({
      timeoutSeconds: 60,
      memory: "256MB"
    })
    .firestore
    .document("receipts/{receiptId}")
    .onCreate(async (snap, context) => {
      const receipt = snap.data();
      console.log("[Cloud Function] Starting verification for receipt:",
          context.params.receiptId);

      try {
        // 1. Mark as verifying
        await snap.ref.update({
          status: "verifying",
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log("[Cloud Function] Marked as verifying");

        // 2. Download image from Firebase Storage
        const imageBuffer = await downloadImageFromStorage(receipt.storagePath);
        console.log("[Cloud Function] Downloaded image from Storage");

        // 3. Call Thunder API with image
        const verification = await verifyWithThunderAPI(imageBuffer);
        console.log("[Cloud Function] Thunder API response:", verification);

        // 4. Update with result
        const isVerified = verification.status === 200;
        await snap.ref.update({
          status: isVerified ? "verified" : "failed",
          thunderResult: verification.data,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 5. Log successful verification
        if (isVerified) {
          const data = verification.data.data || {};
          const transRef = data.transRef;
          const amount = data.amount && data.amount.amount;
          const sender = data.sender && data.sender.account &&
              data.sender.account.name && data.sender.account.name.en;

          console.log("[Cloud Function] ✅ Transaction verified:", transRef);
          console.log("[Cloud Function] Amount:", amount);
          console.log("[Cloud Function] Sender:", sender);
        } else {
          console.log("[Cloud Function] ❌ Transaction verification failed");
        }
      } catch (error) {
        console.error("[Cloud Function] Error during verification:", error);
        await snap.ref.update({
          status: "error",
          error: error.message,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

/**
 * Helper function to download image from Firebase Storage
 * @param {string} storagePath - Path to the image in Storage
 * @return {Promise<Buffer>} - Image buffer
 */
async function downloadImageFromStorage(storagePath) {
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  const [imageBuffer] = await file.download();
  return imageBuffer;
}

// Helper function to test Thunder API (for debugging)
exports.testThunderAPI = functions
    .region("asia-southeast1")
    .runWith({
      timeoutSeconds: 60,
      memory: "256MB"
    })
    .https
    .onRequest(async (req, res) => {
  // This is for testing purposes only
  res.send({
    message: "Thunder API test endpoint",
    status: "Ready",
    auth: "Configured",
  });
});
