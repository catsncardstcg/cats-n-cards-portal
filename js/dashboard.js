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
 * Get verification badge HTML for transaction
 */
function getVerificationBadge(transaction) {
    // Check if Thunder API data is available
    if (!transaction.thunderResult || !transaction.thunderResult.sender || !transaction.thunderResult.sender.account) {
        return `<span class="verification-badge no-data">⚠️ No Data</span>`;
    }

    // Extract sender name from Thunder API
    const thunderSenderName = transaction.thunderResult.sender.account.name.th ||
                              transaction.thunderResult.sender.account.name.en ||
                              '';

    // Get expected recipient (LINE display name)
    const expectedRecipient = transaction.lineDisplayName || '';

    // If no sender name or no expected recipient, show warning
    if (!thunderSenderName || !expectedRecipient) {
        return `<span class="verification-badge no-data">⚠️ No Data</span>`;
    }

    // Compare names (case-insensitive, partial matching)
    const senderName = thunderSenderName.toLowerCase().trim();
    const expected = expectedRecipient.toLowerCase().trim();

    // Check for partial match (sender name contains expected or vice versa)
    const isMatch = senderName.includes(expected) || expected.includes(senderName);

    if (isMatch) {
        return `<span class="verification-badge match">✅ Match</span>`;
    } else {
        return `<span class="verification-badge mismatch">❌ Mismatch</span>`;
    }
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
    const tiktokUsername = transaction.tikTokUsername || transaction.tiktok_username || transaction.TikTokUsername || '';
    const initials = getUserInitials(transaction.lineDisplayName || tiktokUsername);

    // Get verification badge
    const verificationBadge = getVerificationBadge(transaction);

    // Get TikTok username - check multiple possible field names
    const tiktokUsername = transaction.tikTokUsername || transaction.tiktok_username || transaction.TikTokUsername || '';

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

    // Set expected recipient (LINE display name)
    document.getElementById('expectedRecipient').textContent = transaction.lineDisplayName || 'N/A';

    // Process Thunder API data
    if (transaction.thunderResult) {
        const formattedData = formatThunderApiResponse(transaction.thunderResult);
        document.getElementById('thunderDataContent').textContent = formattedData.formattedText;

        // Extract and display sender name
        if (formattedData.senderName) {
            document.getElementById('senderName').textContent = formattedData.senderName;

            // Check verification status
            const expectedRecipient = transaction.lineDisplayName;
            const senderName = formattedData.senderName.toLowerCase().trim();
            const expected = expectedRecipient.toLowerCase().trim();

            if (senderName && expected) {
                const verificationIcon = document.getElementById('verificationIcon');
                const verificationStatus = document.getElementById('verificationStatus');
                const senderNameElement = document.getElementById('senderName');

                if (senderName.includes(expected) || expected.includes(senderName)) {
                    verificationIcon.textContent = '✅';
                    verificationIcon.className = 'verification-icon verification-success';
                    verificationStatus.textContent = 'Sender name matches expected recipient';
                    verificationStatus.style.color = '#28a745';
                    senderNameElement.style.borderColor = '#28a745';
                } else {
                    verificationIcon.textContent = '❌';
                    verificationIcon.className = 'verification-icon verification-error';
                    verificationStatus.textContent = 'Warning: Sender name does not match expected recipient';
                    verificationStatus.style.color = '#dc3545';
                    senderNameElement.style.borderColor = '#dc3545';
                }
            } else {
                document.getElementById('verificationIcon').textContent = '⚠️';
                document.getElementById('verificationIcon').className = 'verification-icon verification-warning';
                document.getElementById('verificationStatus').textContent = 'Unable to verify sender information';
            }
        } else {
            document.getElementById('senderName').textContent = 'Not available';
            document.getElementById('verificationIcon').textContent = '⚠️';
            document.getElementById('verificationIcon').className = 'verification-icon verification-warning';
            document.getElementById('verificationStatus').textContent = 'Sender information not available';
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
            formattedText: formattedText
        };

    } catch (error) {
        console.error('Error formatting Thunder API response:', error);
        return {
            senderName: null,
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


