# Firebase Cloud Functions Deployment Guide

## Prerequisites
- Firebase CLI installed
- Logged into Firebase with `firebase login`
- Project selected: `cats-n-cards-tcg`

## Quick Deployment Steps

### 1. Initialize Cloud Functions (First Time Only)
```bash
# Navigate to your project directory
cd /path/to/cats-n-cards-portal

# Initialize Cloud Functions (if not already done)
firebase init functions

# Select these options:
# - Use existing project: cats-n-cards-tcg
# - Language: JavaScript
# - ESLint: Yes
# - Install dependencies: Yes
```

### 2. Install Dependencies
```bash
cd functions
npm install
```

### 3. Deploy to Firebase
```bash
firebase deploy --only functions
```

## Testing the Cloud Functions

### Test Thunder API Connection
After deployment, test the Thunder API by uploading a receipt:
1. Go to payment.html or delivery.html
2. Upload any bank receipt image
3. Check Firebase Console → Functions → Logs for verification logs

### Expected Log Messages
You should see logs like:
```
[Cloud Function] Starting verification for receipt: abc123
[Cloud Function] Marked as verifying
[Cloud Function] Downloaded image from Storage
[Thunder API] Starting verification...
[Thunder API] ✅ Verification completed in 1500ms
[Cloud Function] ✅ Transaction verified: THX_123456789
[Cloud Function] Amount: 1000
[Cloud Function] Sender: Somchai Jaidee
```

## Verifying Deployment

### Check Cloud Functions Status
```bash
firebase functions:list
```

### View Function Logs
```bash
firebase functions:log
```

### Test HTTP Function
```bash
curl https://asia-southeast1-cats-nards-tcg.cloudfunctions.net/testThunderAPI
```

## Next Steps After Deployment

1. **Test Upload Flow:**
   - Upload a receipt through payment.html
   - Check status in Firestore Console
   - Verify Thunder API logs

2. **Build Dashboard:**
   - Create streamer-dashboard.html
   - Connect to Firestore for real-time updates

3. **Monitor Results:**
   - Check Firestore → Data → receipts collection
   - Look for documents with status: "verified" or "failed"

## Troubleshooting

### Common Issues:

1. **Deployment Failed:**
   - Check Firebase login: `firebase login`
   - Check project selection: `firebase projects:list`
   - Check billing: Make sure you're on Blaze plan

2. **Function Times Out:**
   - Thunder API might be slow, check response time
   - Verify auth token is correct

3. **Permission Denied:**
   - Check Firestore security rules
   - Ensure Cloud Functions have admin privileges

## Security Notes

- The auth token is stored in thunder-api.js
- For production, consider using environment variables
- Restrict function access to trusted domains
- Monitor function usage and costs

## Cost Monitoring

Check Firebase Console → Functions → Usage to monitor:
- Invocations
- Execution time
- Memory usage
- Billing

## What to Expect

After successful deployment and testing:

1. **Customer Uploads:** Instant upload to Firebase Storage
2. **Thunder API:** Automatic verification starts within seconds
3. **Real-time Status:** Firestore documents update with verification results
4. **Dashboard Ready:** Connect to show live transaction status

The Cloud Function will automatically process every new receipt uploaded to the `receipts` collection in Firestore.