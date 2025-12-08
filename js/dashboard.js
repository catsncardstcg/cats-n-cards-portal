/**
 * Stream Dashboard - Real-time Transaction Monitor
 * Firebase Firestore integration for live receipt verification tracking
 */

// Global variables
let db;
let transactions = [];
let currentFilter = 'all';
let searchQuery = '';
let unsubscribe;

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Dashboard] Initializing...');

    // Initialize Firebase
    if (typeof initializeFirebase === 'function') {
        initializeFirebase();
    }

    // Wait for Firebase to be ready
    const initCheck = setInterval(() => {
        if (typeof isFirestoreReady === 'function' && isFirestoreReady()) {
            clearInterval(initCheck);
            initializeDashboard();
        }
    }, 100);

    // Fallback timeout
    setTimeout(() => {
        if (typeof isFirestoreReady !== 'function' || !isFirestoreReady()) {
            console.error('[Dashboard] Firebase initialization timeout');
            showError('Failed to initialize Firebase. Please refresh the page.');
        }
    }, 5000);
});

/**
 * Initialize the dashboard
 */
function initializeDashboard() {
    console.log('[Dashboard] Firebase ready, initializing dashboard...');

    // Get Firestore instance
    db = getFirebaseFirestore();

    if (!db) {
        console.error('[Dashboard] Failed to get Firestore instance');
        showError('Failed to connect to database. Please refresh the page.');
        return;
    }

    console.log('[Dashboard] Connected to Firestore successfully');

    // Setup event listeners
    setupEventListeners();

    // Start real-time transaction monitoring
    startRealtimeMonitoring();

    console.log('[Dashboard] Dashboard initialized successfully');
}

/**
 * Setup event listeners for UI interactions
 */
function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-button').forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove active class from all buttons
            document.querySelectorAll('.filter-button').forEach(btn => {
                btn.classList.remove('active');
            });

            // Add active class to clicked button
            e.target.classList.add('active');

            // Update filter and refresh display
            currentFilter = e.target.dataset.filter;
            updateTransactionDisplay();
        });
    });

    // Search box
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
        searchBox.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            updateTransactionDisplay();
        });
    }

    console.log('[Dashboard] Event listeners configured');
}

/**
 * Start real-time monitoring of receipts collection
 */
function startRealtimeMonitoring() {
    console.log('[Dashboard] Starting real-time monitoring...');

    // Query receipts collection ordered by upload time
    const receiptsQuery = db.collection('receipts')
        .orderBy('uploadedAt', 'desc')
        .limit(50); // Load last 50 transactions

    // Set up real-time listener
    unsubscribe = receiptsQuery.onSnapshot(
        (snapshot) => {
            console.log(`[Dashboard] Received ${snapshot.docChanges().length} changes`);

            // Process document changes
            snapshot.docChanges().forEach((change) => {
                const transaction = {
                    id: change.doc.id,
                    ...change.doc.data()
                };

                if (change.type === 'added') {
                    handleNewTransaction(transaction);
                } else if (change.type === 'modified') {
                    handleUpdatedTransaction(transaction);
                }
            });

            // Update statistics and display
            updateStatistics();
            updateTransactionDisplay();

            console.log('[Dashboard] Real-time update processed');
        },
        (error) => {
            console.error('[Dashboard] Firestore listener error:', error);
            showError('Failed to load transactions. Please refresh the page.');
        }
    );

    console.log('[Dashboard] Real-time monitoring started');
}

/**
 * Handle new transaction
 */
function handleNewTransaction(transaction) {
    // Remove from existing transactions if present (to avoid duplicates)
    transactions = transactions.filter(t => t.id !== transaction.id);

    // Add new transaction at the beginning
    transactions.unshift(transaction);

    console.log(`[Dashboard] New transaction: ${transaction.tikTokUsername} - ${transaction.status}`);

    // Show notification for new pending transactions
    if (transaction.status === 'pending') {
        showNotification(`New receipt from ${transaction.tikTokUsername}`, 'info');
    }
}

/**
 * Handle updated transaction
 */
function handleUpdatedTransaction(transaction) {
    const existingIndex = transactions.findIndex(t => t.id === transaction.id);

    if (existingIndex !== -1) {
        const oldStatus = transactions[existingIndex].status;
        transactions[existingIndex] = transaction;

        // Show notification for status changes
        if (oldStatus !== transaction.status) {
            const statusMessages = {
                'verified': '✅ Transaction verified',
                'failed': '❌ Transaction failed',
                'verifying': '⏳ Verifying transaction'
            };

            const message = statusMessages[transaction.status] || `Status updated to ${transaction.status}`;
            showNotification(`${transaction.tikTokUsername}: ${message}`,
                             transaction.status === 'verified' ? 'success' : 'info');
        }

        console.log(`[Dashboard] Updated transaction: ${transaction.tikTokUsername} - ${oldStatus} → ${transaction.status}`);
    }
}

/**
 * Update statistics display
 */
function updateStatistics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayTransactions = transactions.filter(t => {
        const uploadTime = t.uploadedAt?.toDate();
        return uploadTime && uploadTime >= todayStart;
    });

    const pendingTransactions = transactions.filter(t => t.status === 'pending');
    const verifiedTransactions = transactions.filter(t => t.status === 'verified');
    const totalAmount = todayTransactions
        .filter(t => t.amount && t.status === 'verified')
        .reduce((sum, t) => sum + t.amount, 0);

    // Update DOM
    updateElement('todayCount', todayTransactions.length);
    updateElement('pendingCount', pendingTransactions.length);
    updateElement('verifiedCount', verifiedTransactions.length);
    updateElement('totalAmount', `฿${totalAmount.toLocaleString()}`);

    console.log(`[Dashboard] Statistics updated: ${todayTransactions.length} today, ${pendingTransactions.length} pending`);
}

/**
 * Update transaction display based on current filter and search
 */
function updateTransactionDisplay() {
    const container = document.getElementById('transactionsContainer');
    if (!container) return;

    // Filter transactions
    let filteredTransactions = transactions.filter(transaction => {
        // Status filter
        if (currentFilter !== 'all' && transaction.status !== currentFilter) {
            return false;
        }

        // Search filter
        if (searchQuery) {
            const username = transaction.tikTokUsername?.toLowerCase() || '';
            const displayName = transaction.lineDisplayName?.toLowerCase() || '';
            return username.includes(searchQuery) || displayName.includes(searchQuery);
        }

        return true;
    });

    // Clear loading spinner
    container.innerHTML = '';

    if (filteredTransactions.length === 0) {
        showEmptyState(container);
        return;
    }

    // Render transactions
    filteredTransactions.forEach(transaction => {
        const transactionCard = createTransactionCard(transaction);
        container.appendChild(transactionCard);
    });

    console.log(`[Dashboard] Displayed ${filteredTransactions.length} transactions`);
}

/**
 * Create transaction card element
 */
function createTransactionCard(transaction) {
    const card = document.createElement('div');
    card.className = `transaction-card ${transaction.status}`;
    card.dataset.transactionId = transaction.id;

    // Format timestamps and amounts
    const uploadTime = transaction.uploadedAt?.toDate();
    const timeAgo = uploadTime ? getTimeAgo(uploadTime) : 'Unknown';
    const amount = transaction.amount ? `฿${transaction.amount.toLocaleString()}` : 'N/A';

    // Get user initials for avatar
    const initials = getUserInitials(transaction.lineDisplayName || transaction.tikTokUsername);

    card.innerHTML = `
        <div class="transaction-header">
            <div class="transaction-user">
                <div class="user-avatar">${initials}</div>
                <div class="user-info">
                    <h3>${transaction.tikTokUsername || 'Unknown'}</h3>
                    <p>${transaction.lineDisplayName || 'No display name'}</p>
                </div>
            </div>
            <div class="transaction-amount">${amount}</div>
        </div>

        <div class="transaction-details">
            <div class="detail-item">
                <span class="detail-label">Type</span>
                <span class="detail-value">${transaction.uploadType || 'payment'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Time</span>
                <span class="detail-value">${timeAgo}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Status</span>
                <span class="detail-value">
                    <span class="status-badge ${transaction.status}">${transaction.status}</span>
                </span>
            </div>
            <div class="detail-item">
                <span class="detail-label">File Size</span>
                <span class="detail-value">${formatFileSize(transaction.fileSize || 0)}</span>
            </div>
        </div>

        ${transaction.downloadURL ? `
            <img src="${transaction.downloadURL}" alt="Receipt" class="receipt-preview"
                 onclick="viewReceipt('${transaction.downloadURL}', '${transaction.tikTokUsername}')">
        ` : ''}

        <div class="transaction-actions">
            ${transaction.status === 'pending' ? `
                <button class="action-button approve" onclick="updateTransactionStatus('${transaction.id}', 'verified')">
                    ✅ Approve
                </button>
                <button class="action-button reject" onclick="updateTransactionStatus('${transaction.id}', 'failed')">
                    ❌ Reject
                </button>
            ` : ''}
            <button class="action-button view" onclick="viewTransactionDetails('${transaction.id}')">
                👁️ View Details
            </button>
        </div>
    `;

    return card;
}

/**
 * Show empty state when no transactions
 */
function showEmptyState(container) {
    container.innerHTML = `
        <div class="empty-state">
            <h3>No transactions found</h3>
            <p>${searchQuery ? 'Try adjusting your search terms' : 'Transactions will appear here when customers upload receipts'}</p>
        </div>
    `;
}

/**
 * Update element content safely
 */
function updateElement(id, content) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = content;
    }
}

/**
 * Get user initials for avatar
 */
function getUserInitials(name) {
    if (!name) return '?';

    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Get time ago string
 */
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

/**
 * Show error message
 */
function showError(message) {
    const container = document.getElementById('transactionsContainer');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <h3 style="color: #f44336;">Error</h3>
                <p>${message}</p>
            </div>
        `;
    }
}

/**
 * View receipt in full screen
 */
function viewReceipt(imageUrl, username) {
    window.open(imageUrl, `_blank`, `width=800,height=600,scrollbars=yes,title=${username}'s Receipt`);
}

/**
 * View transaction details
 */
function viewTransactionDetails(transactionId) {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    const details = `
Transaction Details:
=================
User: ${transaction.tikTokUsername}
Display Name: ${transaction.lineDisplayName}
Amount: ${transaction.amount ? `฿${transaction.amount}` : 'N/A'}
Type: ${transaction.uploadType}
Status: ${transaction.status}
Uploaded: ${transaction.uploadedAt?.toDate()}
File: ${transaction.fileName}
Size: ${formatFileSize(transaction.fileSize || 0)}

Thunder API Result:
${JSON.stringify(transaction.thunderResult, null, 2)}
    `;

    alert(details);
}

/**
 * Update transaction status (manual override)
 */
function updateTransactionStatus(transactionId, newStatus) {
    if (!confirm(`Are you sure you want to mark this transaction as ${newStatus}?`)) {
        return;
    }

    db.collection('receipts').doc(transactionId).update({
        status: newStatus,
        verifiedAt: new Date(),
        verifiedBy: 'streamer',
        manualOverride: true
    }).then(() => {
        showNotification(`Transaction marked as ${newStatus}`, 'success');
    }).catch(error => {
        console.error('[Dashboard] Error updating transaction:', error);
        showNotification('Failed to update transaction', 'error');
    });
}

/**
 * Cleanup when page is unloaded
 */
window.addEventListener('beforeunload', () => {
    if (unsubscribe) {
        unsubscribe();
    }
});


// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);