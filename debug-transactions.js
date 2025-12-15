/**
 * Debug script to examine Firebase transaction data
 * Run this script to check what Thunder API actually returns
 */

// Firebase configuration (same as firebase-config.js)
const firebaseConfig = {
    apiKey: "AIzaSyD1LsJ_NlxOFGpeSp6BeeUzFIhEMOsMVsY",
    authDomain: "cats-n-cards-tcg.firebaseapp.com",
    databaseURL: "https://cats-n-cards-tcg-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "cats-n-cards-tcg",
    storageBucket: "cats-n-cards-tcg.firebasestorage.app",
    messagingSenderId: "62209237814",
    appId: "1:62209237814:web:08b5039c6b819781ebc997"
};

// Initialize Firebase
let firebaseApp = null;
let firebaseFirestore = null;

function initializeFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.error('[Debug] Firebase SDK not loaded');
            return false;
        }

        if (!firebaseApp) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        }

        if (!firebaseFirestore) {
            firebaseFirestore = firebase.firestore();
            console.log('[Debug] ✅ Firestore initialized');
        }

        return true;
    } catch (error) {
        console.error('[Debug] Initialization error:', error);
        return false;
    }
}

async function debugTransactions() {
    try {
        if (!initializeFirebase()) {
            console.error('[Debug] Failed to initialize Firebase');
            return;
        }

        console.log('[Debug] 🔍 Examining transaction data...\n');

        // Get all orders from all users
        const usersSnapshot = await firebaseFirestore.collection('users').get();

        let totalOrders = 0;
        let recentOrders = 0;
        let dateIssues = [];

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();

            console.log(`\n=== USER: ${userId} ===`);
            console.log(`Display Name: ${userData.displayName || 'N/A'}`);
            console.log(`TikTok: ${userData.tiktokUsername || 'N/A'}`);

            // Get orders for this user
            const ordersQuery = await firebaseFirestore
                .collection('users')
                .doc(userId)
                .collection('orders')
                .orderBy('submittedAt', 'desc')
                .limit(5) // Get last 5 orders
                .get();

            if (!ordersQuery.empty) {
                console.log(`📊 Orders found: ${ordersQuery.size}`);
                totalOrders += ordersQuery.size;
            }

            for (const orderDoc of ordersQuery.docs) {
                recentOrders++;
                const orderData = orderDoc.data();

                console.log(`\n📦 Order #${orderDoc.id.slice(-8)}`);
                console.log(`   Status: ${orderData.verificationStatus || 'N/A'}`);
                console.log(`   Submitted: ${orderData.submittedAt || 'N/A'}`);
                console.log(`   Amount: ${orderData.amount || 'N/A'}`);
                console.log(`   Is Recent: ${orderData.checks?.isRecent || 'N/A'}`);

                // Check Thunder API data structure
                if (orderData.thunderResult) {
                    console.log(`   📊 Thunder API Data Structure:`);
                    console.log(`      Status: ${orderData.thunderResult.status}`);

                    // Check different possible paths for date
                    const datePaths = [
                        'thunderResult.data.transDate',
                        'thunderResult.data.data.transDate',
                        'thunderResult.data.trans_date',
                        'thunderResult.data.data.trans_date'
                    ];

                    console.log(`      🔍 Date Fields:`);
                    datePaths.forEach(path => {
                        const value = getNestedValue(orderData, path);
                        console.log(`         ${path}: ${value || 'NOT FOUND'}`);
                    });

                    // Log recipient info
                    const recipientPaths = [
                        'thunderResult.data.receiver.bank.account.name.en',
                        'thunderResult.data.data.receiver.bank.account.name.en',
                        'thunderResult.data.receiver.bank.account.name.th',
                        'thunderResult.data.data.receiver.bank.account.name.th'
                    ];

                    console.log(`      👤 Recipient Names:`);
                    recipientPaths.forEach(path => {
                        const value = getNestedValue(orderData, path);
                        if (value) console.log(`         ${path}: ${value}`);
                    });

                    // Log full structure if it's recent but flagged as old
                    if (orderData.checks && !orderData.checks.isRecent && orderData.checks.isValidFormat) {
                        dateIssues.push({
                            orderId: orderDoc.id,
                            userId: userId,
                            thunderResult: orderData.thunderResult,
                            checks: orderData.checks
                        });
                    }
                }
            }
        }

        console.log(`\n📈 SUMMARY:`);
        console.log(`   Total Users: ${usersSnapshot.size}`);
        console.log(`   Total Orders: ${totalOrders}`);
        console.log(`   Recent Orders: ${recentOrders}`);
        console.log(`   Date Issues: ${dateIssues.length}`);

        // Show problematic orders
        if (dateIssues.length > 0) {
            console.log(`\n❌ ORDERS WITH DATE ISSUES:`);
            dateIssues.forEach((issue, index) => {
                console.log(`\n   ${index + 1}. Order ID: ${issue.orderId.slice(-8)}`);
                console.log(`      User: ${issue.userId}`);
                console.log(`      Thunder Result Status: ${issue.thunderResult.status}`);
                console.log(`      Valid Format: ${issue.checks.isValidFormat}`);
                console.log(`      Is Recent: ${issue.checks.isRecent}`);
                console.log(`      Full Thunder Result:`, JSON.stringify(issue.thunderResult, null, 2));
            });
        }

    } catch (error) {
        console.error('[Debug] Error examining transactions:', error);
    }
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

// Run the debug function
if (typeof window !== 'undefined') {
    // Browser environment - expose to window
    window.debugTransactions = debugTransactions;
    console.log('[Debug] Debug function loaded. Run debugTransactions() to start.');
} else {
    // Node.js environment - run automatically
    debugTransactions();
}