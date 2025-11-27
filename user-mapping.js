/**
 * User Mapping Module for Cats N Cards Portal
 * Handles LINE ID <-> TikTok Username mapping with Registration Gate
 */

// Configuration - UPDATE THIS with your Google Apps Script URL
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbw1sCDdn_Z1TzOrN6rJCy_IZ-u7Va_CTg0AqMG226YhNDbEIW8wHzNyjv9RgU9ZAViH/exec';

// Global state
let userMapping = {
    lineUserId: null,
    tiktokUsername: null,
    lineDisplayName: null,
    linePictureUrl: null,
    isLoaded: false
};

// Loading overlay state
let loadingOverlay = null;

/**
 * Show debug panel with registration info (for troubleshooting)
 */
function showDebugPanel(lineUserId, backendResponse) {
    // Remove existing debug panel if any
    const existing = document.getElementById('debug-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.innerHTML = `
        <style>
            #debug-panel {
                position: fixed;
                top: 10px;
                left: 10px;
                right: 10px;
                background: white;
                border: 3px solid #f44336;
                border-radius: 12px;
                padding: 15px;
                z-index: 10002;
                font-family: monospace;
                font-size: 12px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            #debug-panel h3 {
                margin: 0 0 10px 0;
                color: #f44336;
                font-size: 14px;
            }
            #debug-panel .debug-row {
                margin: 8px 0;
                padding: 8px;
                background: #f5f5f5;
                border-radius: 4px;
                word-break: break-all;
            }
            #debug-panel .debug-label {
                font-weight: bold;
                color: #333;
            }
            #debug-panel .debug-value {
                color: #666;
                margin-top: 4px;
            }
            #debug-panel button {
                margin-top: 10px;
                padding: 8px 16px;
                background: #f44336;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
            }
        </style>
        <h3>🔍 Registration Debug Info</h3>
        <div class="debug-row">
            <div class="debug-label">LINE User ID:</div>
            <div class="debug-value">${lineUserId || 'null'}</div>
        </div>
        <div class="debug-row">
            <div class="debug-label">Backend Response:</div>
            <div class="debug-value">${JSON.stringify(backendResponse, null, 2)}</div>
        </div>
        <div class="debug-row">
            <div class="debug-label">Check Results:</div>
            <div class="debug-value">
                mapping exists: ${!!backendResponse}<br>
                mapping.success: ${backendResponse?.success}<br>
                mapping.tiktokUsername: ${backendResponse?.tiktokUsername || 'null'}
            </div>
        </div>
        <button onclick="document.getElementById('debug-panel').remove()">Close Debug Panel</button>
    `;
    document.body.appendChild(panel);
}

/**
 * Show loading overlay with message
 */
function showLoadingOverlay(message = 'Loading...') {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'registration-loading-overlay';
        loadingOverlay.innerHTML = `
            <style>
                #registration-loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: fadeIn 0.2s;
                }
                #registration-loading-overlay .loading-content {
                    text-align: center;
                    color: white;
                    padding: 30px;
                }
                #registration-loading-overlay .spinner {
                    width: 50px;
                    height: 50px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin: 0 auto 20px;
                }
                #registration-loading-overlay .message {
                    font-size: 1.1em;
                    font-weight: 500;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            </style>
            <div class="loading-content">
                <div class="spinner"></div>
                <div class="message">${message}</div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    } else {
        loadingOverlay.querySelector('.message').textContent = message;
    }
}

/**
 * Update loading overlay message
 */
function updateLoadingMessage(message) {
    if (loadingOverlay) {
        loadingOverlay.querySelector('.message').textContent = message;
    }
}

/**
 * Hide loading overlay
 */
function hideLoadingOverlay() {
    if (loadingOverlay) {
        loadingOverlay.style.animation = 'fadeOut 0.2s';
        setTimeout(() => {
            if (loadingOverlay && loadingOverlay.parentNode) {
                loadingOverlay.parentNode.removeChild(loadingOverlay);
                loadingOverlay = null;
            }
        }, 200);
    }
}

/**
 * Initialize user mapping system with registration gate
 * Must be called after LIFF is initialized
 * @returns {Promise<Object>} User mapping object
 */
async function initializeUserMapping() {
    try {
        // Show loading overlay immediately
        showLoadingOverlay('Initializing...');

        // Check if LIFF is ready
        if (!isLIFFReady()) {
            console.log('[UserMapping] LIFF not ready, skipping initialization');
            hideLoadingOverlay();
            return null;
        }

        updateLoadingMessage('Loading your profile...');

        // Get LINE profile
        const lineUserId = getLINEUserId();
        const lineDisplayName = getLINEDisplayName();
        const linePictureUrl = getLINEPictureUrl();

        userMapping.lineUserId = lineUserId;
        userMapping.lineDisplayName = lineDisplayName;
        userMapping.linePictureUrl = linePictureUrl;

        // DEBUG: Show LINE user ID for verification
        console.log('========================================');
        console.log('[UserMapping] 🔍 LINE USER ID:', lineUserId);
        console.log('[UserMapping] 👤 Display Name:', lineDisplayName);
        console.log('========================================');

        // Check sessionStorage cache first (instant!)
        const cachedMapping = sessionStorage.getItem(`mapping_${lineUserId}`);
        if (cachedMapping) {
            const cached = JSON.parse(cachedMapping);
            userMapping.tiktokUsername = cached.tiktokUsername;
            userMapping.isLoaded = true;
            console.log('[UserMapping] ✅ Loaded from cache (instant):', cached.tiktokUsername);
            hideLoadingOverlay();
            return userMapping;
        }

        console.log('[UserMapping] No cache, checking backend for:', lineUserId);
        updateLoadingMessage('Checking registration...');

        // Check if mapping exists in backend
        const mapping = await checkUserMapping(lineUserId);

        // DEBUG: Log full response from backend
        console.log('[UserMapping] Backend response:', JSON.stringify(mapping, null, 2));
        console.log('[UserMapping] Checking conditions:');
        console.log('  - mapping exists:', !!mapping);
        console.log('  - mapping.success:', mapping?.success);
        console.log('  - mapping.tiktokUsername:', mapping?.tiktokUsername);

        // DEBUG: Show debug panel on screen (for mobile testing)
        showDebugPanel(lineUserId, mapping);

        if (mapping && mapping.success && mapping.tiktokUsername) {
            // User has existing mapping - cache it!
            userMapping.tiktokUsername = mapping.tiktokUsername;
            userMapping.isLoaded = true;

            // Cache for instant load on other pages
            sessionStorage.setItem(`mapping_${lineUserId}`, JSON.stringify({
                tiktokUsername: mapping.tiktokUsername,
                timestamp: Date.now()
            }));

            console.log('[UserMapping] ✅ Found mapping and cached:', mapping.tiktokUsername);
            hideLoadingOverlay();
        } else {
            // First-time user - show registration modal (blocking)
            console.log('[UserMapping] No mapping found, showing registration gate');
            hideLoadingOverlay();
            await promptTikTokUsername();
        }

        return userMapping;

    } catch (error) {
        console.error('[UserMapping] Initialization error:', error);
        hideLoadingOverlay();
        return null;
    }
}

/**
 * Check if LINE user ID has TikTok mapping in backend
 * @param {string} lineUserId - LINE user ID
 * @returns {Promise<Object>} Mapping result
 */
async function checkUserMapping(lineUserId) {
    try {
        const url = `${BACKEND_URL}?action=getUserMapping&lineUserId=${encodeURIComponent(lineUserId)}`;

        // Add 3 second timeout - if backend is slow, fail fast
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        const result = await response.json();
        return result;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn('[UserMapping] Backend timeout (>3s), treating as no mapping');
        } else {
            console.error('[UserMapping] Error checking mapping:', error);
        }
        return { success: false, error: error.message };
    }
}

/**
 * Save LINE ID <-> TikTok username mapping to backend
 * @param {string} lineUserId - LINE user ID
 * @param {string} tiktokUsername - TikTok username
 * @param {string} lineDisplayName - LINE display name
 * @param {string} linePictureUrl - LINE profile picture URL
 * @returns {Promise<Object>} Save result
 */
async function saveUserMapping(lineUserId, tiktokUsername, lineDisplayName, linePictureUrl) {
    try {
        const data = {
            action: 'saveUserMapping',
            lineUserId: lineUserId,
            tiktokUsername: tiktokUsername,
            lineDisplayName: lineDisplayName,
            lineProfilePictureUrl: linePictureUrl
        };

        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('[UserMapping] Error saving mapping:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Show blocking registration modal for first-time users
 * Modal cannot be dismissed until registration is complete
 * @returns {Promise<string|null>} TikTok username or null if cancelled
 */
async function promptTikTokUsername() {
    return new Promise((resolve) => {
        // Create blocking modal overlay (cannot click outside to close)
        const modalHTML = `
            <div id="tiktok-username-modal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                animation: fadeIn 0.3s;
            ">
                <div id="registration-card" style="
                    background: white;
                    padding: 40px 30px;
                    border-radius: 20px;
                    max-width: 450px;
                    width: 90%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                    animation: slideUp 0.4s;
                ">
                    <div style="font-size: 4em; margin-bottom: 15px;">🎮</div>
                    <h2 style="color: #333; margin-bottom: 10px; font-size: 1.6em; font-weight: 700;">
                        ยินดีต้อนรับ ${userMapping.lineDisplayName}!
                    </h2>
                    <p style="color: #666; margin-bottom: 10px; font-size: 1.05em; line-height: 1.5;">
                        กรุณาลงทะเบียนด้วย TikTok Username<br>
                        เพื่อเข้าใช้งาน Cats N Cards Portal
                    </p>
                    <p style="color: #999; margin-bottom: 25px; font-size: 0.9em;">
                        ระบบจะจดจำคุณโดยอัตโนมัติในครั้งถัดไป
                    </p>
                    <input
                        type="text"
                        id="tiktok-username-input"
                        placeholder="@yourtiktok"
                        style="
                            width: 100%;
                            padding: 16px;
                            border: 2px solid #e0e0e0;
                            border-radius: 12px;
                            font-size: 1.15em;
                            margin-bottom: 20px;
                            box-sizing: border-box;
                            transition: border-color 0.3s;
                        "
                    />
                    <button
                        id="save-tiktok-username-btn"
                        style="
                            width: 100%;
                            padding: 16px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            border: none;
                            border-radius: 12px;
                            font-size: 1.15em;
                            font-weight: 600;
                            cursor: pointer;
                            transition: transform 0.2s, box-shadow 0.2s;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102,126,234,0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
                    >
                        ลงทะเบียน / Register
                    </button>
                    <p style="color: #999; margin-top: 20px; font-size: 0.85em; line-height: 1.4;">
                        🔒 ข้อมูลของคุณจะถูกเก็บไว้อย่างปลอดภัย<br>
                        เฉพาะเพื่อการระบุตัวตนในระบบเท่านั้น
                    </p>
                </div>
            </div>
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                #tiktok-username-input:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
                }
            </style>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('tiktok-username-modal');
        const input = document.getElementById('tiktok-username-input');
        const saveBtn = document.getElementById('save-tiktok-username-btn');

        // Focus input after a short delay
        setTimeout(() => input.focus(), 400);

        // Handle Enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });

        // Handle save button click
        saveBtn.onclick = async () => {
            const tiktokUsername = input.value.trim();

            if (!tiktokUsername) {
                input.style.borderColor = '#f44336';
                input.placeholder = 'กรุณาใส่ TikTok Username';
                input.style.animation = 'shake 0.3s';
                setTimeout(() => input.style.animation = '', 300);
                return;
            }

            // Add @ if not present
            const formattedUsername = tiktokUsername.startsWith('@')
                ? tiktokUsername
                : '@' + tiktokUsername;

            // Disable inputs and show loading
            input.disabled = true;
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.7';
            saveBtn.textContent = 'กำลังบันทึก...';

            // Save to backend
            const result = await saveUserMapping(
                userMapping.lineUserId,
                formattedUsername,
                userMapping.lineDisplayName,
                userMapping.linePictureUrl
            );

            if (result.success) {
                // Save successful
                userMapping.tiktokUsername = formattedUsername;
                userMapping.isLoaded = true;

                // Cache immediately for instant access on other pages
                sessionStorage.setItem(`mapping_${userMapping.lineUserId}`, JSON.stringify({
                    tiktokUsername: formattedUsername,
                    timestamp: Date.now()
                }));

                // Show success message
                const card = document.getElementById('registration-card');
                card.style.animation = 'slideUp 0.4s';
                card.innerHTML = `
                    <div style="font-size: 5em; margin-bottom: 20px;">✅</div>
                    <h2 style="color: #4CAF50; margin-bottom: 15px; font-size: 1.8em;">ลงทะเบียนสำเร็จ!</h2>
                    <p style="color: #666; font-size: 1.1em; margin-bottom: 10px;">
                        TikTok: <strong>${formattedUsername}</strong>
                    </p>
                    <p style="color: #999; font-size: 0.95em;">กำลังเข้าสู่ระบบ...</p>
                `;

                // Close modal and resolve
                setTimeout(() => {
                    modal.style.animation = 'fadeOut 0.3s';
                    setTimeout(() => {
                        modal.remove();
                        resolve(formattedUsername);
                    }, 300);
                }, 1500);
            } else {
                // Save failed - allow retry
                alert('❌ ไม่สามารถบันทึกได้ กรุณาลองใหม่\nPlease try again');
                input.disabled = false;
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.textContent = 'ลงทะเบียน / Register';
                input.focus();
            }
        };
    });
}

/**
 * Get TikTok username for current user
 * @returns {string|null} TikTok username or null
 */
function getTikTokUsername() {
    return userMapping.tiktokUsername;
}

/**
 * Get LINE user ID
 * @returns {string|null} LINE user ID or null
 */
function getMappedLINEUserId() {
    return userMapping.lineUserId;
}

/**
 * Check if user mapping is loaded
 * @returns {boolean} True if mapping is loaded
 */
function isMappingLoaded() {
    return userMapping.isLoaded;
}

/**
 * Auto-fill TikTok username in input field
 * @param {string} inputId - Input field ID
 */
function autoFillTikTokUsername(inputId) {
    const input = document.getElementById(inputId);
    if (input && userMapping.tiktokUsername) {
        input.value = userMapping.tiktokUsername;
        console.log('[UserMapping] Auto-filled TikTok username:', userMapping.tiktokUsername);
    }
}

/**
 * Show personalized greeting
 * @param {string} containerId - Container element ID
 */
function showPersonalizedGreeting(containerId) {
    const container = document.getElementById(containerId);
    if (container && userMapping.lineDisplayName) {
        const greeting = `
            <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            ">
                <p style="margin: 0; font-size: 1.2em;">
                    สวัสดี ${userMapping.lineDisplayName}! 👋
                </p>
            </div>
        `;
        container.innerHTML = greeting + container.innerHTML;
    }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeUserMapping,
        checkUserMapping,
        saveUserMapping,
        promptTikTokUsername,
        getTikTokUsername,
        getMappedLINEUserId,
        isMappingLoaded,
        autoFillTikTokUsername,
        showPersonalizedGreeting
    };
}
