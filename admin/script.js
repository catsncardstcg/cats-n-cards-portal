// Firebase is now loaded via script tags in index.html
// Using Firebase compat version - all functions should be called via firebase.*

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD1LsJ_NlxOFGpeSp6BeeUzFIhEMOsMVsY",
    authDomain: "cats-n-cards-tcg.firebaseapp.com",
    projectId: "cats-n-cards-tcg",
    storageBucket: "cats-n-cards-tcg.firebasestorage.app",
    messagingSenderId: "62209237814",
    appId: "1:62209237814:web:08b5039c6b819781ebc997"
};

// Initialize Firebase (using compat version)
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variables
let incomingUnsubscribe = null;
let shippingUnsubscribe = null;
let selectedShippingOrders = new Set();
const ADMIN_PASSWORD = 'catsncards123'; // Move to environment variable in production

// Authentication
function login() {
    const password = document.getElementById('password').value;
    if (password === ADMIN_PASSWORD) {
        localStorage.setItem('adminAuth', 'true');
        showDashboard();
    } else {
        document.getElementById('error-msg').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('error-msg').classList.add('hidden');
        }, 3000);
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

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    // Start real-time listeners
    listenToIncomingSlips();
    listenToReadyToShip();

    // Update next delivery date
    document.getElementById('next-delivery-date').textContent = formatDeliveryDate(getNextDeliveryDate());

    // Start refresh countdown
    startRefreshCountdown();
}

// Tab management
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });

    // Remove active class from all buttons
    document.querySelectorAll('#tab-btn-incoming, #tab-btn-shipping, #tab-btn-stats').forEach(btn => {
        btn.classList.remove('tab-active');
        btn.classList.add('text-gray-600');
        btn.classList.remove('text-blue-600');
    });

    // Show selected tab
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    // Add active class to selected button
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    activeBtn.classList.add('tab-active');
    activeBtn.classList.remove('text-gray-600');
    activeBtn.classList.add('text-blue-600');

    // Load stats when stats tab is shown
    if (tabName === 'stats') {
        loadStats();
    }
}

// Real-time incoming slips listener
function listenToIncomingSlips() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const q = db.collection('orders')
        .where('verifiedAt', '>', twentyFourHoursAgo)
        .orderBy('verifiedAt', 'desc')
        .limit(50);

    incomingUnsubscribe = q.onSnapshot((snapshot) => {
        const container = document.getElementById('incoming-list');
        container.innerHTML = '';

        let count = 0;
        let todayCount = 0;
        const today = new Date().toDateString();

        snapshot.forEach((doc) => {
            const order = { id: doc.id, ...doc.data() };
            container.appendChild(createSlipCard(order));
            count++;

            if (new Date(order.verifiedAt?.toDate?.() || order.verifiedAt).toDateString() === today) {
                todayCount++;
            }
        });

        document.getElementById('today-count').textContent = `Today: ${todayCount}`;

        // Update stats
        updateStats(snapshot.docs);
    });
}

// Real-time ready to ship listener
function listenToReadyToShip() {
    const nextDelivery = getNextDeliveryDate();

    const q = db.collection('orders')
        .where('status', '==', 'ready_to_ship')
        .where('deliveryRound', '==', nextDelivery.day)
        .orderBy('createdAt', 'asc');

    shippingUnsubscribe = q.onSnapshot((snapshot) => {
        const container = document.getElementById('shipping-list');
        container.innerHTML = '';

        document.getElementById('shipping-count').textContent =
            `${snapshot.size} orders (${selectedShippingOrders.size} selected)`;

        snapshot.forEach((doc) => {
            const order = { id: doc.id, ...doc.data() };
            container.appendChild(createShippingCard(order));
        });
    });
}

// Create slip card for incoming slips
function createSlipCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card bg-white rounded-lg shadow p-4';

    // Determine status badge
    let statusClass = 'status-gray';
    let statusText = '⚫ Unknown';
    let statusIcon = '';

    if (order.checks?.allPassed) {
        statusClass = 'status-green';
        statusText = '🟢 AUTO-VERIFIED';
        statusIcon = '✓';
    } else if (order.verificationStatus === 'pending_check') {
        statusClass = 'status-yellow';
        statusText = '🟡 NEEDS CHECK';
        statusIcon = '⚠';
    } else if (order.verificationStatus === 'rejected') {
        statusClass = 'status-red';
        statusText = '🔴 REJECTED';
        statusIcon = '✗';
    }

    const verifiedTime = order.verifiedAt?.toDate?.() || new Date(order.verifiedAt);
    const timeAgo = formatTimeAgo(verifiedTime);

    // TikTok linking status
    let tiktokBadge = '';
    if (order.tiktokUsername) {
        tiktokBadge = `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-.96 1.39-2.39 2.41-3.94 2.94-1.57.54-3.29.71-4.9.41-1.49-.27-2.89-1.04-3.93-2.17-.54-.58-.93-1.27-1.29-1.97-.72.08-1.43.02-2.03-.43-.78-.57-1.23-1.57-1.04-2.53.19-.98.96-1.75 1.94-1.92.75-.13 1.57.07 2.14.6.69.64.94 1.68.65 2.57.83.31 1.71.49 2.61.49.87-.01 1.74-.21 2.51-.6.83-.42 1.54-1.1 1.99-1.93.33-.62.49-1.32.49-2.02-.01-3.44.01-6.88-.02-10.31-.66.38-1.29.8-2 1.09-1.3.52-2.71.73-4.11.66-.02 1.46-.04 2.92-.02 4.38-.01.69-.14 1.38-.42 2.01-.46 1.08-1.39 1.92-2.52 2.25-1.13.32-2.4.15-3.38-.49-.89-.59-1.48-1.58-1.55-2.64-.07-1.03.38-2.08 1.18-2.73.74-.6 1.71-.84 2.62-.67.07.02.14.03.2.04-.01-1.86-.02-3.72-.01-5.58 1.31-.02 2.61-.01 3.91-.02z"/>
            </svg>
            @${order.tiktokUsername}
        </span>`;
    } else {
        tiktokBadge = `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            ❌ No TikTok linked
        </span>`;
    }

    card.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <span class="px-3 py-1 rounded text-sm font-medium ${statusClass}">
                ${statusText}
            </span>
            <span class="text-sm text-gray-500">${timeAgo}</span>
        </div>

        <div class="mb-3">
            <div class="font-bold text-lg flex items-center gap-2">
                ${order.displayName || 'Unknown'}
                ${tiktokBadge}
            </div>
            <div class="text-sm text-gray-700 mt-1">
                ฿${(order.amount || 0).toLocaleString()} → ${order.receiverName || 'Unknown'} (${order.receiverBank || 'N/A'})
            </div>
            <div class="text-sm text-gray-600">
                From: ${order.senderName || 'Unknown'} (${order.senderBank || 'N/A'})
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
            Ref: ${(order.transactionId || '').substring(0, 12)}...
            ${order.pointsEarned ? ` | Points: +${order.pointsEarned}` : ''}
        </div>

        <div class="flex gap-2 flex-wrap">
            ${order.slipImageUrl ? `
                <button onclick="viewSlip('${order.id}')"
                        class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200">
                    VIEW SLIP
                </button>
            ` : ''}
            ${!order.tiktokUsername ? `
                <button onclick="linkToTikTok('${order.id}', '${order.lineUserId}')"
                        class="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200">
                    🔗 LINK TIKTOK
                </button>
            ` : ''}
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

// Create shipping card for ready to ship orders
function createShippingCard(order) {
    const card = document.createElement('div');
    card.className = `order-card bg-white rounded-lg shadow p-4 cursor-pointer ${selectedShippingOrders.has(order.id) ? 'ring-2 ring-blue-500' : ''}`;
    card.onclick = () => toggleShippingOrder(order.id);

    card.innerHTML = `
        <div class="flex items-start justify-between">
            <div class="flex items-start space-x-3 flex-1">
                <input type="checkbox"
                       class="mt-1 order-checkbox"
                       ${selectedShippingOrders.has(order.id) ? 'checked' : ''}
                       onclick="event.stopPropagation()">
                <div class="flex-1">
                    <div class="font-bold">
                        ${order.deliveryAddress?.fullName || 'No Name'}
                        ${order.tiktokUsername ? `<span class="text-blue-600 ml-2">@${order.tiktokUsername}</span>` : ''}
                    </div>
                    <div class="text-sm text-gray-700 mt-1">
                        📞 ${order.deliveryAddress?.phone || 'No Phone'}
                    </div>
                    <div class="text-sm text-gray-600 mt-1">
                        🏠 ${order.deliveryAddress?.address || 'No Address'}
                    </div>
                    <div class="text-sm text-gray-600">
                        🏙️ ${order.deliveryAddress?.province || 'No Province'}
                        ${order.deliveryAddress?.postalCode ? order.deliveryAddress.postalCode : ''}
                    </div>
                    ${order.amount ? `
                        <div class="text-sm mt-1">
                            💰 ฿${order.amount.toLocaleString()} (+${order.pointsEarned || 0} pts)
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    return card;
}

// Toggle shipping order selection
function toggleShippingOrder(orderId) {
    if (selectedShippingOrders.has(orderId)) {
        selectedShippingOrders.delete(orderId);
    } else {
        selectedShippingOrders.add(orderId);
    }

    // Refresh the shipping list to update checkboxes
    listenToReadyToShip();
}

// Select all shipping orders
function selectAll() {
    const cards = document.querySelectorAll('#shipping-list .order-card');
    cards.forEach(card => {
        const orderId = card.getAttribute('data-order-id');
        if (orderId) {
            selectedShippingOrders.add(orderId);
        }
    });
    listenToReadyToShip();
}

// Clear selection
function clearSelection() {
    selectedShippingOrders.clear();
    listenToReadyToShip();
}

// Export to Google Sheets
async function exportToSheets() {
    if (selectedShippingOrders.size === 0) {
        alert('กรุณาเลือกคำสั่งซื้อก่อน Export');
        return;
    }

    try {
        // Get selected orders data
        const ordersData = [];
        for (const orderId of selectedShippingOrders) {
            const docRef = doc(db, 'orders', orderId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                ordersData.push({ id: orderId, ...docSnap.data() });
            }
        }

        // Call Google Apps Script
        const response = await fetch('YOUR_APPS_SCRIPT_WEB_APP_URL', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders: ordersData })
        });

        if (response.ok) {
            const result = await response.json();
            alert(`✅ Exported ${ordersData.length} orders successfully!`);
            clearSelection();
        } else {
            alert('❌ Export failed. Please try again.');
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('❌ Export failed. Please check console for details.');
    }
}

// Order actions
async function approveOrder(orderId) {
    try {
        const docRef = doc(db, 'orders', orderId);
        await updateDoc(docRef, {
            verificationStatus: 'verified',
            status: 'pending_address',
            checks: {
                ...{ allPassed: true, correctRecipient: true },
                approvedBy: 'admin',
                approvedAt: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        });

        alert('✅ Order approved successfully');
    } catch (error) {
        console.error('Approval error:', error);
        alert('❌ Approval failed');
    }
}

async function rejectOrder(orderId) {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;

    try {
        const docRef = doc(db, 'orders', orderId);
        await updateDoc(docRef, {
            verificationStatus: 'rejected',
            status: 'rejected',
            rejectionReason: reason,
            rejectedBy: 'admin',
            rejectedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        alert('✅ Order rejected successfully');
    } catch (error) {
        console.error('Rejection error:', error);
        alert('❌ Rejection failed');
    }
}

async function addNote(orderId) {
    const note = prompt('Enter admin note:');
    if (!note) return;

    try {
        const docRef = doc(db, 'orders', orderId);
        await updateDoc(docRef, {
            adminNotes: note,
            updatedAt: serverTimestamp()
        });

        alert('✅ Note added successfully');
    } catch (error) {
        console.error('Note error:', error);
        alert('❌ Failed to add note');
    }
}

// Manual TikTok linking function (Option B)
async function linkToTikTok(orderId, lineUserId) {
    const tiktokUsername = prompt('Enter TikTok username (without @):');
    if (!tiktokUsername) return;

    // Clean and validate TikTok username
    const cleanUsername = tiktokUsername.trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, '');

    // Validate format
    const regex = /^[a-z0-9_.]{2,24}$/;
    if (!regex.test(cleanUsername)) {
        alert('❌ Invalid TikTok username format. Use 2-24 characters (letters, numbers, underscore, period only).');
        return;
    }

    try {
        // Check if username is already linked to another user
        const existingMapping = await getDoc(doc(db, 'userMappings', lineUserId));
        if (existingMapping.exists() && existingMapping.data().tiktokUsername === cleanUsername) {
            alert('⚠️ This TikTok username is already linked to this user.');
            return;
        }

        // Check if TikTok username is already linked to someone else
        const querySnapshot = await getDocs(
            query(collection(db, 'userMappings'), where('tiktokUsername', '==', cleanUsername))
        );

        if (!querySnapshot.empty) {
            const existingUser = querySnapshot.docs[0].data();
            const confirm = prompt(`⚠️ TikTok username @${cleanUsername} is already linked to: ${existingUser.displayName || existingUser.lineUserId}\n\nType "FORCE" to unlink and relink to this user:`);
            if (confirm !== 'FORCE') return;

            // Delete existing mapping
            await deleteDoc(doc(db, 'userMappings', querySnapshot.docs[0].id));

            // Update existing orders to remove the TikTok username
            const existingLineUserId = querySnapshot.docs[0].id;
            const existingOrdersSnapshot = await getDocs(
                query(collection(db, 'orders'), where('lineUserId', '==', existingLineUserId))
            );

            const batch = writeBatch(db);
            existingOrdersSnapshot.docs.forEach(orderDoc => {
                batch.update(orderDoc.ref, { tiktokUsername: null });
            });
            await batch.commit();
        }

        // Create user mapping
        await setDoc(doc(db, 'userMappings', lineUserId), {
            lineUserId: lineUserId,
            tiktokUsername: cleanUsername,
            linkMethod: 'admin_manual',
            linkedBy: 'admin',
            linkedAt: serverTimestamp(),
            orderId: orderId // Reference to the order that triggered this linking
        });

        // Update the order
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            tiktokUsername: cleanUsername,
            linkMethod: 'admin_manual',
            manuallyLinked: true,
            updatedAt: serverTimestamp()
        });

        // Update all other orders for this user
        const userOrdersSnapshot = await getDocs(
            query(collection(db, 'orders'), where('lineUserId', '==', lineUserId))
        );

        const batch = writeBatch(db);
        userOrdersSnapshot.docs.forEach(orderDoc => {
            if (orderDoc.id !== orderId) {
                batch.update(orderDoc.ref, {
                    tiktokUsername: cleanUsername,
                    linkMethod: 'admin_manual',
                    manuallyLinked: true,
                    updatedAt: serverTimestamp()
                });
            }
        });
        await batch.commit();

        alert(`✅ Successfully linked LINE user to @${cleanUsername}`);

    } catch (error) {
        console.error('TikTok linking error:', error);
        alert('❌ Failed to link TikTok username');
    }
}

// View slip image
function viewSlip(orderId) {
    // This would need to be implemented based on how you store slip images
    const slipImage = document.getElementById('slip-image');
    const slipDetails = document.getElementById('slip-details');

    // Set a placeholder or fetch actual image
    slipImage.src = '/api/placeholder-slip.jpg'; // Replace with actual image URL

    // Show modal
    document.getElementById('slip-modal').classList.remove('hidden');
}

function closeSlipModal() {
    document.getElementById('slip-modal').classList.add('hidden');
}

// Load statistics
async function loadStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const q = db.collection('orders')
            .where('verifiedAt', '>=', today)
            .orderBy('verifiedAt', 'desc');

        const snapshot = await q.get();
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let totalSales = 0;
        let verifiedCount = 0;

        const statusCounts = {
            pending_address: 0,
            ready_to_ship: 0,
            shipped: 0,
            rejected: 0,
            pending_check: 0
        };

        orders.forEach(order => {
            totalSales += order.amount || 0;
            if (order.verificationStatus === 'verified') verifiedCount++;
            statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
        });

        document.getElementById('stats-sales').textContent = `฿${totalSales.toLocaleString()}`;
        document.getElementById('stats-orders').textContent = orders.length;
        document.getElementById('stats-verified').textContent = verifiedCount;

        // Status breakdown
        const breakdownHtml = Object.entries(statusCounts).map(([status, count]) => `
            <div class="flex justify-between items-center py-2 border-b">
                <span class="text-gray-600">${getStatusText(status)}</span>
                <span class="font-semibold">${count}</span>
            </div>
        `).join('');

        document.getElementById('stats-breakdown').innerHTML = breakdownHtml;

    } catch (error) {
        console.error('Stats error:', error);
    }
}

// Helper functions
function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

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

    return {
        day: days[nextDate.getDay()],
        date: nextDate
    };
}

function formatDeliveryDate(deliveryDate) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return deliveryDate.date.toLocaleDateString('th-TH', options);
}

function getStatusText(status) {
    const statusMap = {
        'pending_address': 'รอกรอกที่อยู่',
        'ready_to_ship': 'พร้อมจัดส่ง',
        'shipped': 'จัดส่งแล้ว',
        'rejected': 'ปฏิเสธ',
        'pending_check': 'รอตรวจสอบ'
    };
    return statusMap[status] || status;
}

function getIssuesList(checks) {
    const issues = [];
    if (!checks?.correctRecipient) issues.push('ผู้รับไม่ถูกต้อง');
    if (checks?.isDuplicate) issues.push('สลิปซ้ำ');
    if (!checks?.isRecent) issues.push('ธุรกรรมเก่า');
    if (!checks?.validBank) issues.push('ธนาคารไม่รองรับ');
    return issues.join(', ') || 'Unknown issue';
}

function updateStats(docs) {
    // This is already handled in the real-time listener
}

// Refresh countdown
function startRefreshCountdown() {
    let countdown = 2;
    setInterval(() => {
        countdown = countdown > 0 ? countdown - 1 : 2;
        document.getElementById('refresh-countdown').textContent = countdown;
    }, 1000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});