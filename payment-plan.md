Payment System & Admin Dashboard - Implementation Plan
Overview
This plan covers the migration from web-based receipt upload to LINE OA-based slip verification with Thunder API integration, plus a real-time admin dashboard for managing incoming slips and deliveries.

Part 1: LINE OA Slip Verification System
1.1 Architecture Changes
Current Flow:
Customer → Web Upload Portal → Firebase Storage → Verification
New Flow:
Customer → LINE OA (Send Slip Photo) → Thunder API → Firestore → Auto Reply
         ↓
LINE Rich Menu → LIFF Portal (Address/Points) → Firestore
1.2 Firestore Schema Updates
New Collection: orders
javascript{
  orderId: string,              // Auto-generated doc ID
  lineUserId: string,           // From LINE profile (KEY for linking)
  tiktokUsername: string,       // Optional, from user
  displayName: string,          // From LINE profile
  
  // Verification Data (from Thunder API)
  amount: number,
  verifiedAt: timestamp,
  transactionId: string,        // From bank slip QR
  senderName: string,
  senderBank: string,
  receiverName: string,
  receiverBank: string,
  slipImageUrl: string,         // LINE image URL
  
  // Verification Status
  status: string,               // 'pending_address' | 'ready_to_ship' | 'shipped' | 'rejected'
  verificationStatus: string,   // 'verified' | 'pending_check' | 'rejected'
  
  // Verification Checks
  checks: {
    amountMatch: boolean,
    correctRecipient: boolean,
    isDuplicate: boolean,
    isRecent: boolean,
    validBank: boolean,
    allPassed: boolean
  },
  
  // Delivery Info (filled via LIFF portal)
  deliveryAddress: {
    name: string,
    phone: string,
    address: string,
    province: string,
    postalCode: string,
    submittedAt: timestamp
  },
  
  // Products
  products: [{
    name: string,
    quantity: number,
    price: number
  }],
  
  // Points
  pointsEarned: number,
  
  // Delivery Logistics
  deliveryRound: string,        // 'monday-DD-MMM' | 'wednesday-DD-MMM' | 'saturday-DD-MMM'
  deliveryDate: string,         // 'YYYY-MM-DD'
  trackingNumber: string,       // Optional
  
  // Admin
  adminNotes: string,
  rejectionReason: string,
  
  // Timestamps
  createdAt: timestamp,
  updatedAt: timestamp,
  shippedAt: timestamp
}
New Collection: duplicates (for fast lookup)
javascript{
  // Document ID = transactionId from slip
  transactionId: string,
  firstSeen: timestamp,
  count: number,
  usernames: [string],
  orderIds: [string]
}

1.3 Cloud Functions Implementation
File: functions/src/lineWebhook.js
Purpose: Handle incoming LINE OA messages (slip images)
Dependencies:
json{
  "@line/bot-sdk": "^8.0.0",
  "axios": "^1.6.0",
  "firebase-admin": "^11.11.0"
}
Function Signature:
javascriptexports.lineWebhook = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    // 1. Verify LINE signature
    // 2. Parse webhook events
    // 3. Handle message.image events
    // 4. Download image from LINE
    // 5. Call Thunder API
    // 6. Save to Firestore
    // 7. Reply to user
  });
Implementation Steps:

Signature Verification

javascriptconst crypto = require('crypto');

function validateSignature(body, signature, channelSecret) {
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

Image Download from LINE

javascriptasync function downloadLineImage(messageId) {
  const client = new line.Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
  });
  
  const stream = await client.getMessageContent(messageId);
  const chunks = [];
  
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

Thunder API Integration

javascriptasync function verifySlipWithThunder(imageBuffer) {
  const base64Image = imageBuffer.toString('base64');
  
  const response = await axios.post(
    'https://developer.thunder.in.th/api/v1/verify-slip',
    { image: base64Image },
    {
      headers: {
        'Authorization': `Bearer ${process.env.THUNDER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );
  
  return response.data;
}

Verification Logic

javascriptfunction performChecks(thunderData, yourAccounts) {
  const checks = {
    amountMatch: true, // Can't check without claimed amount
    correctRecipient: checkRecipient(
      thunderData.receiver.account.bank.account,
      yourAccounts
    ),
    isDuplicate: false, // Check separately in Firestore
    isRecent: isWithinHours(thunderData.date, 24),
    validBank: ['KBANK', 'BBL'].includes(thunderData.sender.bank.short)
  };
  
  checks.allPassed = Object.values(checks).every(v => v === true);
  return checks;
}

Save to Firestore

javascriptasync function saveOrder(lineUserId, thunderData, checks) {
  const orderRef = db.collection('orders').doc();
  
  await orderRef.set({
    orderId: orderRef.id,
    lineUserId: lineUserId,
    amount: thunderData.amount.amount,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    transactionId: thunderData.transRef,
    senderName: thunderData.sender.account.name.th,
    senderBank: thunderData.sender.bank.short,
    receiverName: thunderData.receiver.account.name.th,
    receiverBank: thunderData.receiver.bank.short,
    checks: checks,
    status: checks.allPassed ? 'pending_address' : 'pending_check',
    verificationStatus: checks.allPassed ? 'verified' : 'pending_check',
    pointsEarned: Math.floor(thunderData.amount.amount / 10),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return orderRef.id;
}

Reply to User

javascriptasync function replyToUser(replyToken, verificationResult) {
  const client = new line.Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
  });
  
  if (verificationResult.success) {
    await client.replyMessage(replyToken, {
      type: 'text',
      text: `✅ ยืนยันการโอนเงินสำเร็จ!\n\n` +
            `ยอดเงิน: ${verificationResult.amount} ฿\n` +
            `คะแนนที่ได้: +${verificationResult.points} แต้ม\n\n` +
            `กดปุ่ม "📦 กรอกที่อยู่" ด้านล่างเพื่อกรอกที่อยู่จัดส่งค่ะ`
    });
  } else {
    await client.replyMessage(replyToken, {
      type: 'text',
      text: `⚠️ ตรวจสอบไม่ผ่าน\n\n` +
            `${verificationResult.error}\n\n` +
            `กรุณาติดต่อแอดมินค่ะ`
    });
  }
}
Environment Variables Required:
bashLINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
THUNDER_API_KEY=your_thunder_api_key
KBANK_ACCOUNT_LAST_4=1234
BBL_ACCOUNT_LAST_4=5678

File: functions/src/thunderApi.js
Purpose: Thunder API client wrapper
Exports:
javascriptmodule.exports = {
  verifySlip,
  parseThunderResponse,
  handleThunderError
};

1.4 LIFF Portal Updates
File: delivery.html (Address Form)
Changes Required:

Add LIFF Initialization

javascript// At top of script
await liff.init({ liffId: 'YOUR_LIFF_ID' });

if (!liff.isLoggedIn()) {
  liff.login();
}

const profile = await liff.getProfile();
const lineUserId = profile.userId;
const displayName = profile.displayName;

Fetch User's Pending Orders

javascript// Query Firestore for this user's orders
const ordersRef = collection(db, 'orders');
const q = query(
  ordersRef,
  where('lineUserId', '==', lineUserId),
  where('status', '==', 'pending_address'),
  orderBy('verifiedAt', 'desc')
);

const snapshot = await getDocs(q);
const pendingOrders = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));

Display Order Selection

html<div id="order-selection">
  <h3>เลือกคำสั่งซื้อที่ต้องการจัดส่ง:</h3>
  <!-- Generate checkboxes for each pending order -->
</div>

Update Address Submission

javascriptasync function submitAddress(selectedOrderIds, addressData) {
  const batch = writeBatch(db);
  
  selectedOrderIds.forEach(orderId => {
    const orderRef = doc(db, 'orders', orderId);
    batch.update(orderRef, {
      deliveryAddress: addressData,
      status: 'ready_to_ship',
      deliveryRound: calculateNextDeliveryRound(),
      updatedAt: serverTimestamp()
    });
  });
  
  await batch.commit();
  
  // Send LINE confirmation
  await sendLineConfirmation(lineUserId, selectedOrderIds.length);
}

1.5 LINE Rich Menu Configuration
Setup in LINE Developers Console:
json{
  "size": {
    "width": 2500,
    "height": 1686
  },
  "selected": true,
  "name": "Cats N Cards Menu",
  "chatBarText": "เมนู",
  "areas": [
    {
      "bounds": { "x": 0, "y": 0, "width": 1250, "height": 843 },
      "action": {
        "type": "uri",
        "label": "กรอกที่อยู่",
        "uri": "https://liff.line.me/YOUR-LIFF-ID-ADDRESS"
      }
    },
    {
      "bounds": { "x": 1250, "y": 0, "width": 1250, "height": 843 },
      "action": {
        "type": "uri",
        "label": "คะแนน",
        "uri": "https://liff.line.me/YOUR-LIFF-ID-POINTS"
      }
    },
    {
      "bounds": { "x": 0, "y": 843, "width": 1250, "height": 843 },
      "action": {
        "type": "uri",
        "label": "ประวัติ",
        "uri": "https://liff.line.me/YOUR-LIFF-ID-HISTORY"
      }
    },
    {
      "bounds": { "x": 1250, "y": 843, "width": 1250, "height": 843 },
      "action": {
        "type": "message",
        "label": "ติดต่อ",
        "text": "ติดต่อแอดมิน"
      }
    }
  ]
}
```

---

## Part 2: Admin Dashboard

### 2.1 New File Structure
```
/admin/
├── index.html          # Main dashboard
├── style.css           # Dashboard styles
└── script.js           # Dashboard logic
2.2 Dashboard Implementation
File: admin/index.html
html<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - Cats N Cards</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .tab-active { border-bottom: 2px solid #3B82F6; color: #3B82F6; }
    .status-green { background: #D1FAE5; color: #065F46; }
    .status-yellow { background: #FEF3C7; color: #92400E; }
    .status-red { background: #FEE2E2; color: #991B1B; }
    .status-gray { background: #F3F4F6; color: #4B5563; }
  </style>
</head>
<body class="bg-gray-50">
  
  <!-- Login Screen -->
  <div id="login-screen" class="min-h-screen flex items-center justify-center">
    <div class="bg-white p-8 rounded-lg shadow-lg w-96">
      <h2 class="text-2xl font-bold mb-6 text-center">🔒 Admin Login</h2>
      <input type="password" id="password" 
             class="w-full border rounded p-3 mb-4" 
             placeholder="รหัสผ่าน"
             autocomplete="current-password">
      <button onclick="login()" 
              class="w-full bg-blue-500 text-white p-3 rounded hover:bg-blue-600">
        เข้าสู่ระบบ
      </button>
      <p id="error-msg" class="text-red-500 text-sm mt-2 hidden">รหัสผ่านไม่ถูกต้อง</p>
    </div>
  </div>

  <!-- Main Dashboard -->
  <div id="dashboard" class="hidden">
    
    <!-- Header -->
    <div class="bg-white shadow-md p-4 sticky top-0 z-10">
      <div class="container mx-auto flex justify-between items-center">
        <h1 class="text-xl font-bold">🎴 Cats N Cards Admin</h1>
        <div class="flex gap-4 items-center text-sm">
          <span>👤 Non</span>
          <span id="live-indicator" class="flex items-center">
            <span class="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
            LIVE
          </span>
          <span id="today-count" class="font-semibold">Today: 0</span>
          <button onclick="logout()" class="text-gray-600 hover:text-gray-800">
            Logout
          </button>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white border-b sticky top-16 z-10">
      <div class="container mx-auto flex">
        <button onclick="showTab('incoming')" 
                id="tab-btn-incoming"
                class="px-6 py-3 font-medium tab-active">
          📥 Incoming Slips
        </button>
        <button onclick="showTab('shipping')" 
                id="tab-btn-shipping"
                class="px-6 py-3 font-medium text-gray-600 hover:text-gray-800">
          📦 Ready to Ship
        </button>
        <button onclick="showTab('stats')" 
                id="tab-btn-stats"
                class="px-6 py-3 font-medium text-gray-600 hover:text-gray-800">
          📊 Stats
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="container mx-auto p-4">
      
      <!-- Tab 1: Incoming Slips -->
      <div id="tab-incoming" class="tab-content">
        <div class="mb-4 flex justify-between items-center">
          <h2 class="text-lg font-semibold">รอตรวจสอบ</h2>
          <div class="text-sm text-gray-600">
            Auto-refresh: <span id="refresh-countdown">2</span>s
          </div>
        </div>
        <div id="incoming-list" class="space-y-4">
          <!-- Dynamically populated -->
        </div>
      </div>

      <!-- Tab 2: Ready to Ship -->
      <div id="tab-shipping" class="tab-content hidden">
        <div class="mb-4 flex justify-between items-center">
          <h2 class="text-lg font-semibold">
            จัดส่งรอบ: <span id="next-delivery-date"></span>
          </h2>
          <div class="flex gap-2">
            <button onclick="selectAll()" 
                    class="px-4 py-2 bg-gray-200 rounded text-sm">
              ☑️ Select All
            </button>
            <button onclick="exportToSheets()" 
                    class="px-4 py-2 bg-blue-500 text-white rounded text-sm">
              📤 Export to Sheets
            </button>
          </div>
        </div>
        <div id="shipping-count" class="text-sm text-gray-600 mb-4">
          0 orders
        </div>
        <div id="shipping-list" class="space-y-4">
          <!-- Dynamically populated -->
        </div>
      </div>

      <!-- Tab 3: Stats -->
      <div id="tab-stats" class="tab-content hidden">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white p-6 rounded-lg shadow">
            <h3 class="text-gray-600 text-sm mb-2">💰 Total Sales Today</h3>
            <p id="stats-sales" class="text-3xl font-bold">฿0</p>
          </div>
          <div class="bg-white p-6 rounded-lg shadow">
            <h3 class="text-gray-600 text-sm mb-2">📦 Total Orders</h3>
            <p id="stats-orders" class="text-3xl font-bold">0</p>
          </div>
          <div class="bg-white p-6 rounded-lg shadow">
            <h3 class="text-gray-600 text-sm mb-2">✅ Verified</h3>
            <p id="stats-verified" class="text-3xl font-bold">0</p>
          </div>
        </div>
        
        <div class="mt-6 bg-white p-6 rounded-lg shadow">
          <h3 class="font-semibold mb-4">Status Breakdown</h3>
          <div id="stats-breakdown"></div>
        </div>
      </div>

    </div>
  </div>

  <!-- Slip Modal -->
  <div id="slip-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded-lg max-w-2xl max-h-screen overflow-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold">Slip Image</h3>
        <button onclick="closeSlipModal()" class="text-gray-600 hover:text-gray-800 text-2xl">
          ×
        </button>
      </div>
      <img id="slip-image" src="" alt="Slip" class="w-full">
      <div id="slip-details" class="mt-4 text-sm">
        <!-- Order details -->
      </div>
    </div>
  </div>

  <!-- Firebase SDK -->
  <script type="module" src="./script.js"></script>
</body>
</html>

File: admin/script.js
Key Functions to Implement:

Authentication

javascriptconst ADMIN_PASSWORD = 'YOUR_SECURE_PASSWORD'; // Move to env

function login() {
  const password = document.getElementById('password').value;
  if (password === ADMIN_PASSWORD) {
    localStorage.setItem('adminAuth', 'true');
    showDashboard();
  } else {
    document.getElementById('error-msg').classList.remove('hidden');
  }
}

function checkAuth() {
  if (localStorage.getItem('adminAuth') === 'true') {
    showDashboard();
  } else {
    document.getElementById('login-screen').classList.remove('hidden');
  }
}

function logout() {
  localStorage.removeItem('adminAuth');
  location.reload();
}

Real-time Incoming Slips

javascriptimport { getFirestore, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

const db = getFirestore();

function listenToIncomingSlips() {
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
  
  const q = query(
    collection(db, 'orders'),
    where('verifiedAt', '>', twentyFourHoursAgo),
    orderBy('verifiedAt', 'desc'),
    limit(50)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const container = document.getElementById('incoming-list');
    container.innerHTML = '';
    
    let count = 0;
    snapshot.forEach((doc) => {
      const order = { id: doc.id, ...doc.data() };
      container.appendChild(createSlipCard(order));
      count++;
    });
    
    document.getElementById('today-count').textContent = `Today: ${count}`;
    
    // Update stats
    updateStats(snapshot.docs);
  });
  
  return unsubscribe;
}

Create Slip Card

javascriptfunction createSlipCard(order) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-lg shadow p-4';
  
  // Determine status badge
  let statusClass = 'status-gray';
  let statusText = '⚫ Unknown';
  
  if (order.checks?.allPassed) {
    statusClass = 'status-green';
    statusText = '🟢 AUTO-VERIFIED';
  } else if (order.verificationStatus === 'pending_check') {
    statusClass = 'status-yellow';
    statusText = '🟡 NEEDS CHECK';
  } else if (order.verificationStatus === 'rejected') {
    statusClass = 'status-red';
    statusText = '🔴 REJECTED';
  }
  
  card.innerHTML = `
    <div class="flex justify-between items-start mb-3">
      <span class="px-3 py-1 rounded text-sm font-medium ${statusClass}">
        ${statusText}
      </span>
      <span class="text-sm text-gray-500">${timeAgo(order.verifiedAt)}</span>
    </div>
    
    <div class="mb-3">
      <div class="font-bold text-lg">@${order.tiktokUsername || order.displayName || 'Unknown'}</div>
      <div class="text-sm text-gray-700 mt-1">
        ฿${order.amount} → ${order.receiverName} (${order.receiverBank})
      </div>
      <div class="text-sm text-gray-600">
        From: ${order.senderName} (${order.senderBank})
      </div>
    </div>
    
    ${!order.checks?.allPassed ? `
      <div class="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
        <div class="text-sm font-medium text-yellow-800 mb-1">⚠️ Issues:</div>
        <div class="text-xs text-yellow-700">
          ${getIssuesList(order.checks)}
        </div>
      </div>
    ` : ''}
    
    <div class="text-xs text-gray-500 mb-3">
      Status: ${getStatusText(order.status)} | 
      Ref: ${order.transactionId?.substring(0, 12)}...
    </div>
    
    <div class="flex gap-2 flex-wrap">
      <button onclick="viewSlip('${order.id}')" 
              class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200">
        VIEW SLIP
      </button>
      ${order.verificationStatus === 'pending_check' ? `
        <button onclick="approveOrder('${order.id}')" 
                class="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200">
          ✓ APPROVE
        </button>
        <button onclick="rejectOrder('${order.id}')" 
                class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">
          ✗ REJECT
        </button>
      ` : ''}
      <button onclick="addNote('${order.id}')" 
              class="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
        📝 NOTE
      </button>
    </div>
  `;
  
  return card;
}

Ready to Ship List

javascriptfunction listenToReadyToShip() {
  const nextDelivery = getNextDeliveryDate(); // Returns 'wednesday-11-dec'
  
  const q = query(
    collection(db, 'orders'),
    where('status', '==', 'ready_to_ship'),
    where('deliveryRound', '==', nextDelivery),
    orderBy('createdAt', 'asc')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const container = document.getElementById('shipping-list');
    container.innerHTML = '';
    
    document.getElementById('shipping-count').textContent = 
      `${snapshot.size} orders`;
    document.getElementById('next-delivery-date').textContent = 
      formatDeliveryDate(nextDelivery);
    
    snapshot.forEach((doc) => {
      const order = { id: doc.id, ...doc.data() };
      container.appendChild(createShippingCard(order));
    });
  });
  
  return unsubscribe;
}

Export to Google Sheets

javascriptasync function exportToSheets() {
  const selectedOrders = getSelectedOrders();
  
  if (selectedOrders.length === 0) {
    alert('กรุณาเลือกคำสั่งซื้อก่อน');
    return;
  }
  
  // Call Apps Script Web App
  const response = await fetch('YOUR_APPS_SCRIPT_URL', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orders: selectedOrders })
  });
  
  if (response.ok) {
    alert(`✅ ส่งออก ${selectedOrders.length} รายการสำเร็จ!`);
  } else {
    alert('❌ เกิดข้อผิดพลาด');
  }
}

Helper Functions

javascriptfunction timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

function getNextDeliveryDate() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  // Mon=1, Wed=3, Sat=6
  let daysUntilNext;
  if (dayOfWeek < 1) daysUntilNext = 1;
  else if (dayOfWeek < 3) daysUntilNext = 3 - dayOfWeek;
  else if (dayOfWeek < 6) daysUntilNext = 6 - dayOfWeek;
  else daysUntilNext = 1 + (7 - dayOfWeek);
  
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilNext);
  
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  return `${days[nextDate.getDay()]}-${nextDate.getDate()}-${months[nextDate.getMonth()]}`;
}

function getStatusText(status) {
  const statusMap = {
    'pending_address': 'รอกรอกที่อยู่',
    'ready_to_ship': 'พร้อมจัดส่ง',
    'shipped': 'จัดส่งแล้ว',
    'rejected': 'ปฏิเสธ'
  };
  return statusMap[status] || status;
}

function getIssuesList(checks) {
  const issues = [];
  if (!checks.correctRecipient) issues.push('ผู้รับไม่ถูกต้อง');
  if (checks.isDuplicate) issues.push('สลิปซ้ำ');
  if (!checks.isRecent) issues.push('ธุรกรรมเก่า');
  if (!checks.validBank) issues.push('ธนาคารไม่รองรับ');
  return issues.join(', ') || 'Unknown issue';
}

2.3 Google Sheets Export
File: sheets/exportDelivery.gs (Google Apps Script)
javascriptfunction doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const orders = data.orders;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Deliveries');
    
    // Create sheet if doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet('Deliveries');
      // Add headers
      sheet.getRange('A1:G1').setValues([[
        'Name', 'Phone', 'Address', 'Province', 'Postal Code', 'Items', 'COD'
      ]]);
    }
    
    // Clear old data (keep headers)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 7).clear();
    }
    
    // Add new data
    const rows = orders.map(order => [
      order.deliveryAddress.name,
      order.deliveryAddress.phone,
      order.deliveryAddress.address,
      order.deliveryAddress.province,
      order.deliveryAddress.postalCode,
      order.products?.map(p => `${p.name} x${p.quantity}`).join(', ') || 'N/A',
      0 // COD = 0 (already paid)
    ]);
    
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, count: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
Deploy as Web App:

Click "Deploy" > "New deployment"
Type: Web app
Execute as: Me
Who has access: Anyone
Copy the deployment URL


Part 3: Firestore Security Rules
Update: firestore.rules
javascriptrules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Orders collection
    match /orders/{orderId} {
      
      // Cloud Functions can write
      allow create, update: if request.auth != null;
      
      // Admin dashboard can read all (protected by password in app)
      allow read: if true;
      
      // LIFF apps can read their own orders
      allow read: if request.auth != null 
                  && request.auth.uid == resource.data.lineUserId;
      
      // LIFF apps can update delivery address only
      allow update: if request.auth != null
                    && request.auth.uid == resource.data.lineUserId
                    && request.resource.data.diff(resource.data)
                       .affectedKeys()
                       .hasOnly(['deliveryAddress', 'status', 'updatedAt']);
    }
    
    // Duplicates collection (for internal use)
    match /duplicates/{transactionId} {
      allow read, write: if request.auth != null;
    }
    
    // Existing rules for other collections...
  }
}

Part 4: Deployment Checklist
4.1 Environment Setup
Add to functions/.env:
bashLINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
THUNDER_API_KEY=your_thunder_api_key
KBANK_ACCOUNT_LAST_4=1234
BBL_ACCOUNT_LAST_4=5678
ADMIN_PASSWORD=your_secure_password
Set Firebase Functions config:
bashfirebase functions:config:set \
  line.channel_secret="YOUR_SECRET" \
  line.channel_access_token="YOUR_TOKEN" \
  thunder.api_key="YOUR_KEY" \
  accounts.kbank="1234" \
  accounts.bbl="5678"
4.2 Deployment Commands
bash# Deploy everything
firebase deploy

# Or deploy individually
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore:rules
4.3 LINE OA Setup

Set Webhook URL:

Go to LINE Developers Console
Messaging API settings
Webhook URL: https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/lineWebhook
Enable "Use webhook"
Disable "Auto-reply messages"


Create LIFF Apps:

Address form: https://YOUR-PROJECT.web.app/delivery
Points page: https://YOUR-PROJECT.web.app/points
History page: https://YOUR-PROJECT.web.app/history


Setup Rich Menu (as specified in section 1.5)

4.4 Testing
Test Slip Verification:

Send slip image to LINE OA
Check Cloud Functions logs
Verify order created in Firestore
Check LINE auto-reply

Test Address Form:

Click "📦 กรอกที่อยู่" in rich menu
Verify LIFF loads with user's orders
Submit address
Check Firestore update
Verify LINE confirmation

Test Admin Dashboard:

Access /admin
Login with password
Verify real-time updates
Test export to Sheets


Part 5: Migration Steps
5.1 Phase 1: Setup (Week 1)

 Deploy Cloud Functions with LINE webhook
 Configure Thunder API
 Setup LINE OA webhook URL
 Test slip verification with sample images
 Create Firestore indexes

5.2 Phase 2: LIFF Updates (Week 1-2)

 Update delivery.html with LIFF
 Test order fetching by LINE user ID
 Deploy and test in LINE browser
 Setup rich menu

5.3 Phase 3: Admin Dashboard (Week 2)

 Deploy admin dashboard
 Test real-time updates
 Setup Google Sheets export
 Configure password protection

5.4 Phase 4: Go Live (Week 3)

 Announce new system to customers
 Monitor first livestream
 Gather feedback
 Iterate and improve


Part 6: Monitoring & Maintenance
Key Metrics to Track

Slip verification success rate
Average verification time
Duplicate slip attempts
Address submission rate
Delivery completion rate

Logs to Monitor

Cloud Functions execution logs
Thunder API response times
Firestore read/write operations
LIFF initialization errors

Regular Tasks

Check Thunder API quota
Review rejected slips
Monitor admin dashboard usage
Update delivery schedules


Notes for Claude Code
Priority Order:

LINE webhook handler (most critical)
Thunder API integration
Firestore schema setup
LIFF portal updates
Admin dashboard
Google Sheets export

Testing Strategy:

Use Thunder API test mode first
Test with known good/bad slips
Verify all status transitions
Load test with multiple concurrent users

Security Considerations:

Never expose Thunder API key in frontend
Use HTTPS only
Validate all user inputs
Rate limit admin dashboard access
Secure webhook with LINE signature validation


End of Implementation Plan