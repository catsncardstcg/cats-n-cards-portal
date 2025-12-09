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
let paymentMethods = []; // Store payment methods for streamer name verification
let viewMode = 'cards'; // 'cards' | 'table'
let sortConfig = { field: 'uploadedAt', direction: 'desc' };

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
 * Get expected streamer name from payment methods
 * @returns {string} Streamer's account name from active payment methods
 */
function getExpectedStreamerName() {
    // Try to get streamer name from active payment methods
    if (paymentMethods.length > 0) {
        const activeMethods = paymentMethods.filter(method => method.isActive);
        if (activeMethods.length > 0) {
            // Use the account name from the first active payment method
            return activeMethods[0].accountName || '';
        }
    }

    // Fallback to empty string if no payment methods available
    return '';
}

/**
 * Load payment methods for streamer name verification
 */
async function loadPaymentMethodsForVerification() {
    try {
        if (!db) return;

        console.log('[Dashboard] Loading payment methods for streamer verification...');

        const snapshot = await db.collection('paymentMethods')
            .where('isActive', '==', true)
            .orderBy('displayOrder', 'asc')
            .limit(1) // Only need one for verification
            .get();

        paymentMethods = [];
        snapshot.forEach(doc => {
            paymentMethods.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`[Dashboard] Loaded ${paymentMethods.length} active payment methods for verification`);

    } catch (error) {
        console.error('[Dashboard] Error loading payment methods for verification:', error);
    }
}

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

    // Load payment methods for streamer name verification
    loadPaymentMethodsForVerification();

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

                // Debug: Log incoming transaction data
                console.log(`[Dashboard] ${change.type} transaction:`, {
                    id: transaction.id,
                    tikTokUsername: transaction.tikTokUsername,
                    'tiktok_username': transaction.tiktok_username,
                    'TikTokUsername': transaction.TikTokUsername,
                    lineDisplayName: transaction.lineDisplayName
                });

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
    // Update card view
    const cardContainer = document.getElementById('transactionsContainer');
    if (cardContainer) {
        const filteredTransactions = getFilteredTransactions();

        // Clear loading spinner
        cardContainer.innerHTML = '';

        if (filteredTransactions.length === 0) {
            showEmptyState(cardContainer);
        } else {
            // Render transactions as cards
            filteredTransactions.forEach(transaction => {
                const transactionCard = createTransactionCard(transaction);
                cardContainer.appendChild(transactionCard);
            });
        }
    }

    // Update table view if active
    if (viewMode === 'table') {
        generateTransactionTable();
    }

    const filteredTransactions = getFilteredTransactions();
    console.log(`[Dashboard] Displayed ${filteredTransactions.length} transactions in ${viewMode} view`);
}

/**
 * Get verification badge data for transaction
 * @param {Object} transaction - Transaction data
 * @param {boolean} returnHTML - Return HTML string for card view (default: true)
 * @returns {string|Object} HTML string for cards or object with data for tables
 */
function getVerificationBadge(transaction, returnHTML = true) {
    // Check if Thunder API data is available
    if (!transaction.thunderResult || !transaction.thunderResult.receiver || !transaction.thunderResult.receiver.account) {
        const data = {
            icon: '⚠️',
            text: 'No Data',
            class: 'no-data'
        };
        return returnHTML ? `<span class="verification-badge ${data.class}">${data.icon} ${data.text}</span>` : data;
    }

    // Extract RECEIVER name from Thunder API (streamer who received money)
    const thunderReceiverName = transaction.thunderResult.receiver.account.name.th ||
                               transaction.thunderResult.receiver.account.name.en ||
                               '';

    // Get expected recipient (streamer's name from payment methods)
    const expectedRecipient = getExpectedStreamerName();

    // If no receiver name or no expected recipient, show warning
    if (!thunderReceiverName || !expectedRecipient) {
        const data = {
            icon: '⚠️',
            text: 'No Data',
            class: 'no-data'
        };
        return returnHTML ? `<span class="verification-badge ${data.class}">${data.icon} ${data.text}</span>` : data;
    }

    // Compare names (case-insensitive, partial matching)
    const receiverName = thunderReceiverName.toLowerCase().trim();
    const expected = expectedRecipient.toLowerCase().trim();

    // Check for partial match (receiver name contains expected or vice versa)
    const isMatch = receiverName.includes(expected) || expected.includes(receiverName);

    const data = isMatch ? {
        icon: '✅',
        text: 'Verified',
        class: 'verified'
    } : {
        icon: '❌',
        text: 'Suspicious',
        class: 'unverified'
    };

    return returnHTML ? `<span class="verification-badge ${data.class}">${data.icon} ${data.text}</span>` : data;
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

    // Get TikTok username - check multiple possible field names
    const tiktokUsername = transaction.tikTokUsername || transaction.tiktok_username || transaction.TikTokUsername || '';

    // Get user initials for avatar
    const initials = getUserInitials(transaction.lineDisplayName || tiktokUsername);

    // Get verification badge
    const verificationBadge = getVerificationBadge(transaction);

    // Debug: Log username fields for this transaction
    if (transaction.id) {
        console.log(`[Dashboard] Transaction ${transaction.id} username fields:`, {
            tikTokUsername: transaction.tikTokUsername,
            'tiktok_username': transaction.tiktok_username,
            'TikTokUsername': transaction.TikTokUsername,
            resolvedUsername: tiktokUsername
        });
    }

    // Combine usernames for compact display
    const combinedUsername = tiktokUsername && transaction.lineDisplayName
        ? `${tiktokUsername} • ${transaction.lineDisplayName}`
        : tiktokUsername || transaction.lineDisplayName || 'Unknown';

    card.innerHTML = `
        <div class="transaction-header">
            <div class="transaction-user">
                <div class="user-avatar compact">${initials}</div>
                <div class="user-info compact">
                    <h3>${combinedUsername}</h3>
                </div>
            </div>
            <div class="transaction-amount compact">
                <span class="amount-text">${amount}</span>
                ${verificationBadge}
            </div>
        </div>

        <div class="transaction-details compact">
            <div class="detail-item">
                <span class="detail-value">${timeAgo}</span>
            </div>
            <div class="detail-item">
                <span class="detail-value">
                    <span class="status-badge ${transaction.status}">${transaction.status}</span>
                </span>
            </div>
            <div class="detail-item">
                <span class="detail-value">${transaction.uploadType || 'payment'}</span>
            </div>
        </div>

        <div class="transaction-actions compact">
            ${transaction.status === 'pending' ? `
                <button class="action-button compact approve" onclick="updateTransactionStatus('${transaction.id}', 'verified')" title="Approve">
                    ✓
                </button>
                <button class="action-button compact reject" onclick="updateTransactionStatus('${transaction.id}', 'failed')" title="Reject">
                    ✕
                </button>
            ` : ''}
            ${transaction.downloadURL ? `
                <button class="action-button compact view" onclick="showImageGalleryModal('${transaction.downloadURL}', '${tiktokUsername}', '${transaction.lineDisplayName}')" title="View Images">
                    🖼
                </button>
            ` : ''}
            <button class="action-button compact view" onclick="viewTransactionDetails('${transaction.id}')" title="View Details">
                👁
            </button>
            <button class="action-button compact edit" onclick="openEditModal('${transaction.id}')" title="Edit">
                ✏
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
 * View receipt in full screen - now opens gallery modal
 */
function viewReceipt(imageUrl, username) {
    showImageGalleryModal(imageUrl, username);
}

/**
 * View transaction details - Opens modal with formatted data
 */
function viewTransactionDetails(transactionId) {
    showTransactionDetailsModal(transactionId);
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
 * Open edit modal for transaction
 */
function openEditModal(transactionId) {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    // Populate modal fields with current data
    const tiktokUsername = transaction.tikTokUsername || transaction.tiktok_username || transaction.TikTokUsername || '';
    document.getElementById('editTiktokUsername').value = tiktokUsername;
    document.getElementById('editLineDisplayName').value = transaction.lineDisplayName || '';
    document.getElementById('editAmount').value = transaction.amount || '';
    document.getElementById('editNotes').value = transaction.adminNotes || '';

    // Store transaction ID for saving
    document.getElementById('editModal').dataset.transactionId = transactionId;

    // Show modal
    document.getElementById('editModal').style.display = 'flex';
}

/**
 * Close edit modal
 */
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    delete document.getElementById('editModal').dataset.transactionId;
}

/**
 * Save transaction changes
 */
function saveTransaction() {
    const transactionId = document.getElementById('editModal').dataset.transactionId;
    if (!transactionId) {
        showNotification('No transaction selected for editing', 'error');
        return;
    }

    // Get form values
    const tiktokUsername = document.getElementById('editTiktokUsername').value.trim();
    const lineDisplayName = document.getElementById('editLineDisplayName').value.trim();
    const amount = parseFloat(document.getElementById('editAmount').value) || null;
    const adminNotes = document.getElementById('editNotes').value.trim();

    // Validate required fields
    if (!tiktokUsername) {
        showNotification('TikTok username is required', 'error');
        return;
    }

    // Update transaction in Firestore
    db.collection('receipts').doc(transactionId).update({
        tiktokUsername: tiktokUsername,
        lineDisplayName: lineDisplayName,
        amount: amount,
        adminNotes: adminNotes,
        lastModified: new Date(),
        modifiedBy: 'streamer'
    }).then(() => {
        showNotification('Transaction updated successfully', 'success');
        closeEditModal();
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


/**
 * Show transaction details modal
 */
function showTransactionDetailsModal(transactionId) {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) {
        showToast('Transaction not found', 'error');
        return;
    }

    // Debug: Log the entire transaction object
    console.log('[Dashboard] Transaction data for details:', transaction);
    console.log('[Dashboard] TikTok username fields:', {
        tikTokUsername: transaction.tikTokUsername,
        'tiktok_username': transaction.tiktok_username,
        'TikTokUsername': transaction.TikTokUsername
    });

    // Populate transaction details - check multiple possible field names
    const tiktokUsername = transaction.tikTokUsername || transaction.tiktok_username || transaction.TikTokUsername || 'N/A';
    document.getElementById('detailTiktokUsername').textContent = tiktokUsername;
    document.getElementById('detailLineDisplayName').textContent = transaction.lineDisplayName || 'N/A';
    document.getElementById('detailAmount').textContent = transaction.amount ? `฿${transaction.amount}` : 'N/A';
    document.getElementById('detailUploadType').textContent = transaction.uploadType || 'N/A';
    document.getElementById('detailStatus').textContent = transaction.status || 'N/A';
    document.getElementById('detailUploadedAt').textContent = transaction.uploadedAt?.toDate().toLocaleString('th-TH') || 'N/A';
    document.getElementById('detailFileName').textContent = transaction.fileName || 'N/A';
    document.getElementById('detailFileSize').textContent = formatFileSize(transaction.fileSize || 0);

    // Set expected recipient (streamer's name from payment methods)
    const expectedStreamerName = getExpectedStreamerName();
    document.getElementById('expectedRecipient').textContent = expectedStreamerName || 'Not configured';

    // Process Thunder API data
    if (transaction.thunderResult) {
        const formattedData = formatThunderApiResponse(transaction.thunderResult);
        document.getElementById('thunderDataContent').textContent = formattedData.formattedText;

        // Extract and display RECEIVER name (streamer who received money)
        if (formattedData.receiverName) {
            document.getElementById('senderName').textContent = formattedData.receiverName;

            // Check verification status - compare receiver name with expected streamer name
            const receiverName = formattedData.receiverName.toLowerCase().trim();
            const expected = expectedStreamerName.toLowerCase().trim();

            if (receiverName && expected) {
                const verificationIcon = document.getElementById('verificationIcon');
                const verificationStatus = document.getElementById('verificationStatus');
                const receiverNameElement = document.getElementById('senderName');

                if (receiverName.includes(expected) || expected.includes(receiverName)) {
                    verificationIcon.textContent = '✅';
                    verificationIcon.className = 'verification-icon verification-success';
                    verificationStatus.textContent = '✅ Payment received by correct streamer';
                    verificationStatus.style.color = '#28a745';
                    receiverNameElement.style.borderColor = '#28a745';
                } else {
                    verificationIcon.textContent = '❌';
                    verificationIcon.className = 'verification-icon verification-error';
                    verificationStatus.textContent = '❌ Warning: Payment not received by expected streamer';
                    verificationStatus.style.color = '#dc3545';
                    receiverNameElement.style.borderColor = '#dc3545';
                }
            } else {
                document.getElementById('verificationIcon').textContent = '⚠️';
                document.getElementById('verificationIcon').className = 'verification-icon verification-warning';
                document.getElementById('verificationStatus').textContent = 'Unable to verify recipient information';
            }
        } else {
            document.getElementById('senderName').textContent = 'Not available';
            document.getElementById('verificationIcon').textContent = '❌';
            document.getElementById('verificationIcon').className = 'verification-icon verification-error';
            document.getElementById('verificationStatus').textContent = 'No receiver data available from Thunder API';
        }
    } else {
        document.getElementById('senderName').textContent = 'No API data';
        document.getElementById('verificationIcon').textContent = '❌';
        document.getElementById('verificationIcon').className = 'verification-icon verification-error';
        document.getElementById('verificationStatus').textContent = 'No Thunder API data available';
        document.getElementById('thunderDataContent').textContent = 'No API response data available';
    }

    // Show modal
    document.getElementById('detailsModal').style.display = 'flex';

    // Add ESC key listener
    document.addEventListener('keydown', handleDetailsModalESC);
}

/**
 * Format Thunder API response for readable display
 */
function formatThunderApiResponse(thunderData) {
    try {
        // Extract sender name from nested structure
        let senderName = null;

        if (thunderData.sender && thunderData.sender.account && thunderData.sender.account.name) {
            senderName = thunderData.sender.account.name.th || thunderData.sender.account.name.en || null;
        }

        // Extract receiver name from nested structure
        let receiverName = null;

        if (thunderData.receiver && thunderData.receiver.account && thunderData.receiver.account.name) {
            receiverName = thunderData.receiver.account.name.th || thunderData.receiver.account.name.en || null;
        }

        // Build formatted text
        let formattedText = '';

        if (thunderData.transaction && thunderData.transaction.amount) {
            formattedText += `Amount: ${thunderData.transaction.amount}\n`;
        }

        if (thunderData.transaction && thunderData.transaction.reference) {
            formattedText += `Reference: ${thunderData.transaction.reference}\n`;
        }

        if (thunderData.transaction && thunderData.transaction.date) {
            formattedText += `Date: ${new Date(thunderData.transaction.date).toLocaleString('th-TH')}\n`;
        }

        if (thunderData.sender && thunderData.sender.account && thunderData.sender.account.number) {
            formattedText += `Sender Account: ${thunderData.sender.account.number}\n`;
        }

        if (thunderData.sender && thunderData.sender.account && thunderData.sender.account.name) {
            formattedText += `Sender Name: ${thunderData.sender.account.name.th || thunderData.sender.account.name.en || 'N/A'}\n`;
        }

        if (thunderData.sender && thunderData.sender.bank && thunderData.sender.bank.name) {
            formattedText += `Sender Bank: ${thunderData.sender.bank.name.th || thunderData.sender.bank.name.en || 'N/A'}\n`;
        }

        if (thunderData.receiver && thunderData.receiver.account && thunderData.receiver.account.name) {
            formattedText += `Receiver Name: ${thunderData.receiver.account.name.th || thunderData.receiver.account.name.en || 'N/A'}\n`;
        }

        if (thunderData.receiver && thunderData.receiver.account && thunderData.receiver.account.number) {
            formattedText += `Receiver Account: ${thunderData.receiver.account.number}\n`;
        }

        if (thunderData.receiver && thunderData.receiver.bank && thunderData.receiver.bank.name) {
            formattedText += `Receiver Bank: ${thunderData.receiver.bank.name.th || thunderData.receiver.bank.name.en || 'N/A'}\n`;
        }

        // Add any other relevant fields
        if (thunderData.transaction && thunderData.transaction.description) {
            formattedText += `Description: ${thunderData.transaction.description}\n`;
        }

        // If no transaction details were found, fall back to full JSON
        if (!formattedText) {
            formattedText = JSON.stringify(thunderData, null, 2);
        }

        return {
            senderName: senderName,
            receiverName: receiverName,
            formattedText: formattedText
        };

    } catch (error) {
        console.error('Error formatting Thunder API response:', error);
        return {
            senderName: null,
            receiverName: null,
            formattedText: 'Error formatting API response:\n' + JSON.stringify(thunderData, null, 2)
        };
    }
}

/**
 * Close transaction details modal
 */
function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
    document.removeEventListener('keydown', handleDetailsModalESC);
}

/**
 * Handle ESC key for details modal
 */
function handleDetailsModalESC(event) {
    if (event.key === 'Escape') {
        closeDetailsModal();
    }
}

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

// =================================
// IMAGE GALLERY MODAL FUNCTIONALITY
// =================================

let galleryData = {
    images: [],
    currentIndex: 0,
    isZoomed: false,
    touchStartX: 0,
    touchEndX: 0
};

/**
 * Show image gallery modal
 */
function showImageGalleryModal(imageUrl, tiktokUsername, lineDisplayName) {
    // Initialize gallery with current image
    const username = lineDisplayName || tiktokUsername || 'Unknown User';

    // Show single image instead of gallery
    galleryData.images = [{
        url: imageUrl,
        username: username,
        transactionId: 'single-image',
        uploadedAt: new Date()
    }];

    galleryData.currentIndex = 0;

    // Update gallery title
    document.getElementById('galleryTitle').textContent = `${username}'s Receipt`;

    // Hide navigation buttons since we only have one image
    document.getElementById('galleryPrev').style.display = 'none';
    document.getElementById('galleryNext').style.display = 'none';

    // Display current image
    displayCurrentImage();

    // Show modal
    document.getElementById('galleryModal').style.display = 'block';

    // Add event listeners
    setupGalleryEventListeners();

    console.log(`[Gallery] Opened single image gallery for ${username}`);
}

/**
 * Collect all receipt images from a user across all transactions
 */
function collectUserReceiptImages(tiktokUsername, lineDisplayName) {
    const userImages = [];

    transactions.forEach(transaction => {
        // Match by TikTok username or LINE display name
        const isTikTokMatch = tiktokUsername && transaction.tikTokUsername === tiktokUsername;
        const isLineMatch = lineDisplayName && transaction.lineDisplayName === lineDisplayName;

        if ((isTikTokMatch || isLineMatch) && transaction.downloadURL) {
            userImages.push({
                url: transaction.downloadURL,
                username: transaction.lineDisplayName || transaction.tikTokUsername || 'Unknown',
                transactionId: transaction.id,
                uploadedAt: transaction.uploadedAt?.toDate() || new Date(),
                amount: transaction.amount,
                status: transaction.status
            });
        }
    });

    // Sort by upload date (newest first)
    userImages.sort((a, b) => b.uploadedAt - a.uploadedAt);

    return userImages;
}


/**
 * Display current image in gallery
 */
function displayCurrentImage() {
    if (galleryData.images.length === 0) return;

    const currentImage = galleryData.images[galleryData.currentIndex];
    const mainImage = document.getElementById('galleryMainImage');

    mainImage.src = currentImage.url;

    // Reset zoom
    resetZoom();
}





/**
 * Toggle zoom on main image
 */
function toggleZoom() {
    const mainImage = document.getElementById('galleryMainImage');
    galleryData.isZoomed = !galleryData.isZoomed;

    if (galleryData.isZoomed) {
        mainImage.classList.add('zoomed');
    } else {
        mainImage.classList.remove('zoomed');
    }
}

/**
 * Reset zoom
 */
function resetZoom() {
    const mainImage = document.getElementById('galleryMainImage');
    mainImage.classList.remove('zoomed');
    galleryData.isZoomed = false;
}

/**
 * Download current image
 */
function downloadCurrentImage() {
    if (galleryData.images.length === 0) return;

    const currentImage = galleryData.images[galleryData.currentIndex];
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = `receipt_${currentImage.username}_${currentImage.transactionId}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Download started', 'success');
}

/**
 * Close gallery modal
 */
function closeGalleryModal() {
    document.getElementById('galleryModal').style.display = 'none';
    resetZoom();
    removeGalleryEventListeners();
}

/**
 * Setup gallery event listeners
 */
function setupGalleryEventListeners() {
    // Keyboard navigation
    document.addEventListener('keydown', handleGalleryKeyboard);
}

/**
 * Remove gallery event listeners
 */
function removeGalleryEventListeners() {
    document.removeEventListener('keydown', handleGalleryKeyboard);
}

/**
 * Handle keyboard navigation for gallery
 */
function handleGalleryKeyboard(event) {
    switch (event.key) {
        case 'Escape':
            closeGalleryModal();
            break;
        case ' ':
        case 'Enter':
            event.preventDefault();
            toggleZoom();
            break;
    }
}

// =================================
// PAYMENT METHODS MANAGEMENT
// =================================

let paymentMethods = [];
let editingPaymentMethod = null;

/**
 * Initialize payment methods management when dashboard is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    // Setup payment methods event listeners
    setupPaymentMethodsEventListeners();

    // Load payment methods when Firebase is ready
    setTimeout(loadPaymentMethodsForAdmin, 1000);
});

/**
 * Setup event listeners for payment methods management
 */
function setupPaymentMethodsEventListeners() {
    // QR code image preview
    const qrInput = document.getElementById('paymentMethodQR');
    if (qrInput) {
        qrInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.getElementById('qrPreviewImage');
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

/**
 * Load payment methods for admin interface
 */
async function loadPaymentMethodsForAdmin() {
    try {
        console.log('[Dashboard] Loading payment methods for admin...');

        if (typeof getFirebaseFirestore !== 'function') {
            console.error('[Dashboard] Firebase Firestore not available');
            return;
        }

        const db = getFirebaseFirestore();
        const snapshot = await db.collection('paymentMethods')
            .orderBy('displayOrder', 'asc')
            .get();

        paymentMethods = [];
        snapshot.forEach(doc => {
            paymentMethods.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`[Dashboard] Loaded ${paymentMethods.length} payment methods`);

        // Update payment methods display
        updatePaymentMethodsDisplay();

    } catch (error) {
        console.error('[Dashboard] Error loading payment methods:', error);
        const container = document.getElementById('paymentMethodsContainer');
        if (container) {
            container.innerHTML = `
                <div class="payment-method-error">
                    Failed to load payment methods: ${error.message}
                </div>
            `;
        }
    }
}

/**
 * Update payment methods display in admin dashboard
 */
function updatePaymentMethodsDisplay() {
    const container = document.getElementById('paymentMethodsContainer');
    if (!container) return;

    if (!paymentMethods.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>📱 No Payment Methods</h3>
                <p>Click "Add Payment Method" to create your first payment method.</p>
            </div>
        `;
        return;
    }

    const html = paymentMethods.map(method => {
        const typeIcons = {
            'promptpay': '💳',
            'bank_transfer': '🏦',
            'true_wallet': '💙',
            'line_pay': '💚',
            'other': '💰'
        };

        const icon = typeIcons[method.type] || '💰';
        const statusBadge = method.isActive ?
            '<span class="status-badge verified">Active</span>' :
            '<span class="status-badge pending">Inactive</span>';

        return `
            <div class="transaction-card ${method.isActive ? 'verified' : 'pending'}">
                <div class="transaction-header">
                    <div class="transaction-user compact">
                        <div class="user-avatar compact">${icon}</div>
                        <div class="user-info compact">
                            <h3>${method.name}</h3>
                            <p>${method.type.replace('_', ' ')} • Order: ${method.displayOrder || 0}</p>
                        </div>
                    </div>
                    <div class="transaction-amount compact">
                        ${statusBadge}
                    </div>
                </div>

                <div class="transaction-details compact">
                    <div class="detail-item">
                        <span class="detail-label">Account</span>
                        <span class="detail-value">${method.accountNumber || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Name</span>
                        <span class="detail-value">${method.accountName || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">QR Code</span>
                        <span class="detail-value">${method.imageUrl ? '✅ Uploaded' : '❌ Missing'}</span>
                    </div>
                </div>

                <div class="transaction-actions compact">
                    <button class="action-button compact edit" onclick="editPaymentMethod('${method.id}')" title="Edit">
                        ✏️
                    </button>
                    <button class="action-button compact ${method.isActive ? 'reject' : 'approve'}"
                            onclick="togglePaymentMethodStatus('${method.id}')"
                            title="${method.isActive ? 'Deactivate' : 'Activate'}">
                        ${method.isActive ? '⏸️' : '▶️'}
                    </button>
                    <button class="action-button compact view" onclick="viewPaymentMethod('${method.id}')" title="View QR Code">
                        👁️
                    </button>
                    <button class="action-button compact reject" onclick="deletePaymentMethod('${method.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * Open payment method modal for adding new payment method
 */
function openPaymentMethodModal() {
    editingPaymentMethod = null;
    document.getElementById('paymentMethodModalTitle').textContent = '➕ Add Payment Method';
    document.getElementById('paymentMethodForm').reset();
    document.getElementById('paymentMethodId').value = '';
    document.getElementById('qrPreviewImage').style.display = 'none';
    document.getElementById('paymentMethodModal').style.display = 'flex';
}

/**
 * Open payment method modal for editing existing payment method
 */
function editPaymentMethod(id) {
    const method = paymentMethods.find(m => m.id === id);
    if (!method) {
        console.error('[Dashboard] Payment method not found:', id);
        return;
    }

    editingPaymentMethod = method;
    document.getElementById('paymentMethodModalTitle').textContent = '✏️ Edit Payment Method';
    document.getElementById('paymentMethodId').value = method.id;
    document.getElementById('paymentMethodName').value = method.name || '';
    document.getElementById('paymentMethodType').value = method.type || 'promptpay';
    document.getElementById('paymentMethodDescription').value = method.description || '';
    document.getElementById('paymentMethodAccountNumber').value = method.accountNumber || '';
    document.getElementById('paymentMethodAccountName').value = method.accountName || '';
    document.getElementById('paymentMethodDisplayOrder').value = method.displayOrder || 0;
    document.getElementById('paymentMethodActive').checked = method.isActive !== false;

    // Show existing QR code if available
    const preview = document.getElementById('qrPreviewImage');
    if (method.imageUrl) {
        preview.src = method.imageUrl;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }

    document.getElementById('paymentMethodQR').required = false; // Not required when editing
    document.getElementById('paymentMethodModal').style.display = 'flex';
}

/**
 * Close payment method modal
 */
function closePaymentMethodModal() {
    document.getElementById('paymentMethodModal').style.display = 'none';
    document.getElementById('paymentMethodForm').reset();
    editingPaymentMethod = null;
}

/**
 * Save payment method (create or update)
 */
async function savePaymentMethod(event) {
    event.preventDefault();

    try {
        const formData = {
            name: document.getElementById('paymentMethodName').value.trim(),
            type: document.getElementById('paymentMethodType').value,
            description: document.getElementById('paymentMethodDescription').value.trim(),
            accountNumber: document.getElementById('paymentMethodAccountNumber').value.trim(),
            accountName: document.getElementById('paymentMethodAccountName').value.trim(),
            displayOrder: parseInt(document.getElementById('paymentMethodDisplayOrder').value) || 0,
            isActive: document.getElementById('paymentMethodActive').checked
        };

        const paymentMethodId = document.getElementById('paymentMethodId').value;
        const qrFile = document.getElementById('paymentMethodQR').files[0];

        // Validate required fields
        if (!formData.name) {
            alert('Payment method name is required');
            return;
        }

        let imageUrl = editingPaymentMethod?.imageUrl || '';

        // Upload QR code if provided
        if (qrFile) {
            if (typeof uploadQRCode === 'function') {
                imageUrl = await uploadQRCode(qrFile, paymentMethodId || 'temp');
            } else {
                // Fallback upload function
                const storage = getFirebaseStorage();
                if (!storage) {
                    throw new Error('Firebase Storage is not initialized');
                }

                const storageRef = storage.ref();
                const qrCodeRef = storageRef.child(`payment-methods/${paymentMethodId || Date.now()}/qr-code.png`);
                await qrCodeRef.put(qrFile);
                imageUrl = await qrCodeRef.getDownloadURL();
            }
        } else if (!paymentMethodId) {
            // New payment method without QR code
            alert('QR code image is required for new payment methods');
            return;
        }

        const paymentMethodData = {
            ...formData,
            imageUrl: imageUrl
        };

        if (paymentMethodId) {
            // Update existing payment method
            await updatePaymentMethodInDB(paymentMethodId, paymentMethodData);
            showNotification('Payment method updated successfully', 'success');
        } else {
            // Create new payment method
            await createPaymentMethodInDB(paymentMethodData);
            showNotification('Payment method created successfully', 'success');
        }

        // Reload payment methods
        await loadPaymentMethodsForAdmin();

        // Close modal
        closePaymentMethodModal();

    } catch (error) {
        console.error('[Dashboard] Error saving payment method:', error);
        alert('Error saving payment method: ' + error.message);
    }
}

/**
 * Create payment method in database
 */
async function createPaymentMethodInDB(paymentMethodData) {
    const db = getFirebaseFirestore();
    const docRef = await db.collection('paymentMethods').add({
        ...paymentMethodData,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    console.log('[Dashboard] Payment method created with ID:', docRef.id);
    return docRef.id;
}

/**
 * Update payment method in database
 */
async function updatePaymentMethodInDB(id, paymentMethodData) {
    const db = getFirebaseFirestore();
    await db.collection('paymentMethods').doc(id).update({
        ...paymentMethodData,
        updatedAt: new Date()
    });

    console.log('[Dashboard] Payment method updated:', id);
}

/**
 * Toggle payment method active status
 */
async function togglePaymentMethodStatus(id) {
    try {
        const method = paymentMethods.find(m => m.id === id);
        if (!method) return;

        const newStatus = !method.isActive;

        await updatePaymentMethodInDB(id, { isActive: newStatus });

        showNotification(`Payment method ${newStatus ? 'activated' : 'deactivated'}`, 'success');

        // Reload payment methods
        await loadPaymentMethodsForAdmin();

    } catch (error) {
        console.error('[Dashboard] Error toggling payment method status:', error);
        alert('Error updating payment method status: ' + error.message);
    }
}

/**
 * Delete payment method
 */
async function deletePaymentMethod(id) {
    if (!confirm('Are you sure you want to delete this payment method? This action cannot be undone.')) {
        return;
    }

    try {
        const db = getFirebaseFirestore();
        await db.collection('paymentMethods').doc(id).delete();

        showNotification('Payment method deleted successfully', 'success');

        // Reload payment methods
        await loadPaymentMethodsForAdmin();

    } catch (error) {
        console.error('[Dashboard] Error deleting payment method:', error);
        alert('Error deleting payment method: ' + error.message);
    }
}

/**
 * View payment method QR code
 */
function viewPaymentMethod(id) {
    const method = paymentMethods.find(m => m.id === id);
    if (!method || !method.imageUrl) {
        alert('No QR code available for this payment method');
        return;
    }

    // Open QR code in a modal or new window
    window.open(method.imageUrl, '_blank');
}

/**
 * Toggle between card view and table view
 * @param {string} mode - View mode ('cards' or 'table')
 */
function toggleViewMode(mode) {
    console.log(`[Dashboard] toggleViewMode called with mode: ${mode}, current mode: ${viewMode}`);

    if (viewMode === mode) {
        console.log(`[Dashboard] Already in ${mode} mode, returning`);
        return; // Already in this mode
    }

    viewMode = mode;

    // Update UI buttons
    const cardBtn = document.getElementById('cardViewBtn');
    const tableBtn = document.getElementById('tableViewBtn');
    const cardContainer = document.getElementById('transactionsContainer');
    const tableContainer = document.getElementById('tableViewContainer');

    console.log(`[Dashboard] Elements found - cardBtn: ${!!cardBtn}, tableBtn: ${!!tableBtn}, cardContainer: ${!!cardContainer}, tableContainer: ${!!tableContainer}`);

    if (mode === 'cards') {
        console.log('[Dashboard] Switching to card view');
        if (cardBtn) cardBtn.classList.add('active');
        if (tableBtn) tableBtn.classList.remove('active');
        if (cardContainer) cardContainer.style.display = 'block';
        if (tableContainer) tableContainer.style.display = 'none';
    } else {
        console.log('[Dashboard] Switching to table view');
        if (cardBtn) cardBtn.classList.remove('active');
        if (tableBtn) tableBtn.classList.add('active');
        if (cardContainer) cardContainer.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';

        // Generate table if needed
        generateTransactionTable();
    }

    console.log(`[Dashboard] Switched to ${mode} view`);
}

/**
 * Generate transaction table HTML
 */
function generateTransactionTable() {
    console.log('[Dashboard] Generating transaction table...');
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) {
        console.error('[Dashboard] Table tbody not found');
        return;
    }

    const filteredTransactions = getFilteredTransactions();
    const sortedTransactions = sortTransactions(filteredTransactions);

    console.log(`[Dashboard] Found ${filteredTransactions.length} filtered transactions, ${sortedTransactions.length} sorted transactions`);

    if (sortedTransactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-inbox" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
                    No transactions found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = sortedTransactions.map(transaction => createTransactionTableRow(transaction)).join('');

    // Add sort event listeners
    document.querySelectorAll('.transactions-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (sortConfig.field === field) {
                sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortConfig.field = field;
                sortConfig.direction = 'desc';
            }
            updateSortIndicators();
            generateTransactionTable();
        });
    });

    console.log('[Dashboard] Table generated successfully');
}

/**
 * Create a table row for a transaction
 * @param {Object} transaction - Transaction data
 * @returns {string} HTML table row
 */
function createTransactionTableRow(transaction) {
    const verification = getVerificationBadge(transaction);
    const formattedDate = new Date(transaction.uploadedAt).toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    const customerInfo = getCustomerInfo(transaction);
    const amount = (transaction.thunderResult?.amount?.amount || transaction.amount || 0).toLocaleString('en-US');
    const status = transaction.verificationStatus || 'pending';

    return `
        <tr>
            <td>
                <div class="table-date">${formattedDate}</div>
            </td>
            <td>
                <div class="table-customer">
                    ${customerInfo.lineDisplayName}
                    ${customerInfo.tiktokUsername ? `<div class="tiktok">${customerInfo.tiktokUsername}</div>` : ''}
                </div>
            </td>
            <td>
                <div class="table-amount">฿${amount}</div>
            </td>
            <td>
                <span class="table-status ${status}">${status}</span>
            </td>
            <td>
                <div class="table-verification ${verification.class}">
                    ${verification.icon} ${verification.text}
                </div>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-primary" onclick="showTransactionDetailsModal('${transaction.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-info" onclick="viewTransactionDetails('${transaction.id}')" title="View Receipts">
                        <i class="fas fa-image"></i>
                    </button>
                    <button class="btn-warning" onclick="openEditModal('${transaction.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-success" onclick="retryVerification('${transaction.id}')" title="Retry Verification">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Sort transactions based on current sort configuration
 * @param {Array} transactionsToSort - Transactions to sort
 * @returns {Array} Sorted transactions
 */
function sortTransactions(transactionsToSort) {
    return [...transactionsToSort].sort((a, b) => {
        let aValue, bValue;

        switch (sortConfig.field) {
            case 'uploadedAt':
                aValue = new Date(a.uploadedAt);
                bValue = new Date(b.uploadedAt);
                break;
            case 'lineDisplayName':
                aValue = getCustomerInfo(a).lineDisplayName.toLowerCase();
                bValue = getCustomerInfo(b).lineDisplayName.toLowerCase();
                break;
            case 'amount':
                aValue = a.thunderResult?.amount?.amount || a.amount || 0;
                bValue = b.thunderResult?.amount?.amount || b.amount || 0;
                break;
            default:
                return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Update sort indicators in table headers
 */
function updateSortIndicators() {
    document.querySelectorAll('.transactions-table th.sortable').forEach(th => {
        const field = th.dataset.sort;
        const icon = th.querySelector('i');

        if (sortConfig.field === field) {
            th.dataset.sortDirection = sortConfig.direction;
            icon.className = `fas fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`;
        } else {
            delete th.dataset.sortDirection;
            icon.className = 'fas fa-sort';
        }
    });
}

/**
 * Get filtered transactions based on current filter and search
 * @returns {Array} Filtered transactions
 */
function getFilteredTransactions() {
    console.log(`[Dashboard] getFilteredTransactions called - total transactions: ${transactions.length}, currentFilter: ${currentFilter}, searchQuery: "${searchQuery}"`);

    let filtered = transactions;

    // Apply status filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(transaction => {
            const status = transaction.verificationStatus || 'pending';
            return status === currentFilter;
        });
    }

    // Apply advanced search filter
    if (searchQuery) {
        filtered = filtered.filter(transaction => {
            return parseSearchQuery(transaction, searchQuery);
        });
    }

    console.log(`[Dashboard] Filtered to ${filtered.length} transactions`);
    return filtered;
}

/**
 * Get customer info from transaction (handles multiple field name formats)
 * @param {Object} transaction - Transaction data
 * @returns {Object} Customer info with lineDisplayName and tiktokUsername
 */
function getCustomerInfo(transaction) {
    // Get TikTok username - check multiple possible field names
    const tiktokUsername = transaction.tikTokUsername ||
                          transaction.tiktok_username ||
                          transaction.TikTokUsername || '';

    return {
        lineDisplayName: transaction.lineDisplayName || 'Unknown',
        tiktokUsername: tiktokUsername
    };
}

/**
 * Parse advanced search query and match against transaction
 * @param {Object} transaction - Transaction data
 * @param {string} query - Search query
 * @returns {boolean} True if transaction matches search criteria
 */
function parseSearchQuery(transaction, query) {
    const customerInfo = getCustomerInfo(transaction);
    const amount = transaction.thunderResult?.amount?.amount || transaction.amount || 0;
    const uploadDate = new Date(transaction.uploadedAt);

    // Split query by spaces to handle multiple search terms
    const searchTerms = query.toLowerCase().trim().split(/\s+/);

    return searchTerms.every(term => {
        // Amount range searches: ">500", "<1000", "100-500"
        if (term.startsWith('>')) {
            const minAmount = parseFloat(term.substring(1));
            return !isNaN(minAmount) && amount > minAmount;
        }

        if (term.startsWith('<')) {
            const maxAmount = parseFloat(term.substring(1));
            return !isNaN(maxAmount) && amount < maxAmount;
        }

        if (term.includes('-')) {
            const [min, max] = term.split('-').map(v => parseFloat(v.trim()));
            return !isNaN(min) && !isNaN(max) && amount >= min && amount <= max;
        }

        // Exact amount match
        if (term.startsWith('amount:')) {
            const exactAmount = parseFloat(term.substring(7));
            return !isNaN(exactAmount) && amount === exactAmount;
        }

        // Date searches: "today", "yesterday", "2024-01-15", "01/15"
        if (term === 'today') {
            const today = new Date();
            return uploadDate.toDateString() === today.toDateString();
        }

        if (term === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return uploadDate.toDateString() === yesterday.toDateString();
        }

        if (term === 'this week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return uploadDate >= oneWeekAgo;
        }

        // Date format matches: YYYY-MM-DD, MM/DD, DD/MM
        const dateMatch = term.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/) ||
                         term.match(/^(\d{1,2})\/(\d{1,2})$/) ||
                         term.match(/^(\d{1,2})-(\d{1,2})$/);

        if (dateMatch) {
            let year, month, day;
            if (dateMatch[0].includes('-') && dateMatch.length === 4) {
                // YYYY-MM-DD format
                [, year, month, day] = dateMatch;
            } else {
                // MM/DD or DD/MM format - assume current year
                year = new Date().getFullYear();
                if (dateMatch[0].includes('/')) {
                    [, month, day] = dateMatch;
                } else {
                    [, day, month] = dateMatch;
                }
            }

            const searchDate = new Date(year, parseInt(month) - 1, parseInt(day));
            return uploadDate.toDateString() === searchDate.toDateString();
        }

        // Status searches: "status:verified", "status:pending"
        if (term.startsWith('status:')) {
            const status = term.substring(7);
            const transactionStatus = transaction.verificationStatus || 'pending';
            return transactionStatus === status;
        }

        // Verification searches: "verified", "unverified", "suspicious"
        if (['verified', 'unverified', 'suspicious', 'no data'].includes(term)) {
            const verification = getVerificationBadge(transaction, false);
            return verification.text.toLowerCase() === term;
        }

        // Username and display name searches (default)
        return customerInfo.lineDisplayName.toLowerCase().includes(term) ||
               (customerInfo.tiktokUsername && customerInfo.tiktokUsername.toLowerCase().includes(term));
    });
}

/**
 * Open payment methods management modal
 */
function openPaymentMethodsManagementModal() {
    const modal = document.getElementById('paymentMethodsManagementModal');
    modal.style.display = 'flex';
    loadPaymentMethodsForManagement();
    console.log('[Dashboard] Opened payment methods management modal');
}

/**
 * Close payment methods management modal
 */
function closePaymentMethodsManagementModal() {
    const modal = document.getElementById('paymentMethodsManagementModal');
    modal.style.display = 'none';
    console.log('[Dashboard] Closed payment methods management modal');
}

/**
 * Load payment methods for management display
 */
async function loadPaymentMethodsForManagement() {
    try {
        const container = document.getElementById('paymentMethodsList');

        // Show loading state
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
                Loading payment methods...
            </div>
        `;

        // Load payment methods using existing function from payment-methods.js
        if (typeof window.PaymentMethods !== 'undefined') {
            // The payment methods module will populate the global paymentMethods array
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (window.paymentMethods && window.paymentMethods.length > 0) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve();
                }, 3000);
            });
        }

        // Update local paymentMethods array
        if (window.paymentMethods) {
            paymentMethods = window.paymentMethods;
        }

        // Sort by display order and then by name
        const sortedMethods = [...paymentMethods].sort((a, b) => {
            if (a.displayOrder !== b.displayOrder) {
                return a.displayOrder - b.displayOrder;
            }
            return (a.name || '').localeCompare(b.name || '');
        });

        displayPaymentMethodsForManagement(sortedMethods);

    } catch (error) {
        console.error('[Dashboard] Error loading payment methods:', error);
        const container = document.getElementById('paymentMethodsList');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc3545;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
                Failed to load payment methods
            </div>
        `;
    }
}

/**
 * Display payment methods in management modal
 * @param {Array} methods - Payment methods array
 */
function displayPaymentMethodsForManagement(methods) {
    const container = document.getElementById('paymentMethodsList');

    if (methods.length === 0) {
        container.innerHTML = `
            <div class="empty-payment-methods">
                <i class="fas fa-credit-card"></i>
                <h3>No Payment Methods</h3>
                <p>You haven't added any payment methods yet.</p>
                <button class="modal-button save" onclick="openPaymentMethodModal()">
                    <i class="fas fa-plus"></i> Add Your First Payment Method
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = methods.map(method => createPaymentMethodCard(method)).join('');
}

/**
 * Create payment method card HTML for management view
 * @param {Object} method - Payment method data
 * @returns {string} HTML card
 */
function createPaymentMethodCard(method) {
    const isActive = method.isActive !== false;
    const typeLabel = method.type ? method.type.replace('_', ' ').toUpperCase() : 'OTHER';

    return `
        <div class="payment-method-card ${!isActive ? 'inactive' : ''}">
            <div class="payment-method-header">
                <div class="payment-method-title">
                    ${method.name || 'Unnamed Payment Method'}
                    <span class="payment-method-type ${method.type || 'other'}">${typeLabel}</span>
                </div>
                <div class="payment-method-status ${isActive ? 'active' : 'inactive'}">
                    <i class="fas fa-${isActive ? 'check-circle' : 'times-circle'}"></i>
                    ${isActive ? 'Active' : 'Inactive'}
                </div>
            </div>

            <div class="payment-method-details">
                ${method.accountNumber ? `
                    <div class="payment-method-detail">
                        <span class="payment-method-detail-label">Account Number</span>
                        <span class="payment-method-detail-value">${method.accountNumber}</span>
                    </div>
                ` : ''}
                ${method.accountName ? `
                    <div class="payment-method-detail">
                        <span class="payment-method-detail-label">Account Name</span>
                        <span class="payment-method-detail-value">${method.accountName}</span>
                    </div>
                ` : ''}
                ${method.description ? `
                    <div class="payment-method-detail">
                        <span class="payment-method-detail-label">Description</span>
                        <span class="payment-method-detail-value">${method.description}</span>
                    </div>
                ` : ''}
                <div class="payment-method-detail">
                    <span class="payment-method-detail-label">Display Order</span>
                    <span class="payment-method-detail-value">${method.displayOrder || 0}</span>
                </div>
            </div>

            ${method.imageUrl ? `
                <div class="payment-method-qr-preview">
                    <img src="${method.imageUrl}" alt="${method.name} QR Code" onclick="viewPaymentMethod('${method.id}')" style="cursor: pointer;">
                </div>
            ` : ''}

            <div class="payment-method-actions">
                ${method.imageUrl ? `
                    <button class="btn-view" onclick="viewPaymentMethod('${method.id}')" title="View QR Code">
                        <i class="fas fa-eye"></i> View
                    </button>
                ` : ''}
                <button class="btn-edit" onclick="editPaymentMethod('${method.id}')" title="Edit Payment Method">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-toggle" onclick="togglePaymentMethodStatus('${method.id}')" title="${isActive ? 'Deactivate' : 'Activate'}">
                    <i class="fas fa-${isActive ? 'pause' : 'play'}"></i> ${isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button class="btn-delete" onclick="deletePaymentMethodConfirm('${method.id}')" title="Delete Payment Method">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
}

/**
 * Edit payment method
 * @param {string} id - Payment method ID
 */
function editPaymentMethod(id) {
    // Close management modal first
    closePaymentMethodsManagementModal();

    // Use existing function from payment-methods.js if available
    if (typeof window.PaymentMethods !== 'undefined') {
        // Find the payment method
        const method = paymentMethods.find(m => m.id === id);
        if (method) {
            // Open edit modal (this will use existing payment-methods.js functionality)
            setTimeout(() => {
                // Populate form with payment method data
                document.getElementById('paymentMethodId').value = method.id;
                document.getElementById('paymentMethodName').value = method.name || '';
                document.getElementById('paymentMethodType').value = method.type || 'other';
                document.getElementById('paymentMethodDescription').value = method.description || '';
                document.getElementById('paymentMethodAccountNumber').value = method.accountNumber || '';
                document.getElementById('paymentMethodAccountName').value = method.accountName || '';
                document.getElementById('paymentMethodDisplayOrder').value = method.displayOrder || 0;
                document.getElementById('paymentMethodActive').checked = method.isActive !== false;

                // Show existing QR code if available
                if (method.imageUrl) {
                    const preview = document.getElementById('qrPreviewImage');
                    preview.src = method.imageUrl;
                    preview.style.display = 'block';
                    document.getElementById('paymentMethodQR').required = false;
                }

                // Update modal title
                document.getElementById('paymentMethodModalTitle').textContent = '✏️ Edit Payment Method';

                // Open modal
                document.getElementById('paymentMethodModal').style.display = 'flex';
            }, 300);
        }
    }
}

/**
 * Toggle payment method active status
 * @param {string} id - Payment method ID
 */
async function togglePaymentMethodStatus(id) {
    try {
        const method = paymentMethods.find(m => m.id === id);
        if (!method) return;

        const newStatus = !(method.isActive !== false);

        if (typeof window.PaymentMethods !== 'undefined') {
            await window.PaymentMethods.updatePaymentMethod(id, { isActive: newStatus });

            // Update local array
            method.isActive = newStatus;

            // Refresh display
            loadPaymentMethodsForManagement();

            console.log(`[Dashboard] Payment method ${id} ${newStatus ? 'activated' : 'deactivated'}`);
        }
    } catch (error) {
        console.error('[Dashboard] Error toggling payment method status:', error);
        alert('Failed to update payment method status');
    }
}

/**
 * Confirm delete payment method
 * @param {string} id - Payment method ID
 */
function deletePaymentMethodConfirm(id) {
    const method = paymentMethods.find(m => m.id === id);
    if (!method) return;

    if (confirm(`Are you sure you want to delete "${method.name || 'Unnamed'}"? This action cannot be undone.`)) {
        deletePaymentMethodById(id);
    }
}

/**
 * Delete payment method by ID
 * @param {string} id - Payment method ID
 */
async function deletePaymentMethodById(id) {
    try {
        if (typeof window.PaymentMethods !== 'undefined') {
            await window.PaymentMethods.deletePaymentMethod(id);

            // Remove from local array
            paymentMethods = paymentMethods.filter(m => m.id !== id);

            // Refresh display
            loadPaymentMethodsForManagement();

            console.log(`[Dashboard] Payment method ${id} deleted`);
        }
    } catch (error) {
        console.error('[Dashboard] Error deleting payment method:', error);
        alert('Failed to delete payment method');
    }
}


