/**
 * User Mapping Module for Cats N Cards Portal
 * Handles LINE ID <-> TikTok Username mapping
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

/**
 * Initialize user mapping system
 * Must be called after LIFF is initialized
 * @returns {Promise<Object>} User mapping object
 */
async function initializeUserMapping() {
    try {
        // Check if LIFF is ready
        if (!isLIFFReady()) {
            console.log('[UserMapping] LIFF not ready, skipping initialization');
            return null;
        }

        // Get LINE profile
        const lineUserId = getLINEUserId();
        const lineDisplayName = getLINEDisplayName();
        const linePictureUrl = getLINEPictureUrl();

        userMapping.lineUserId = lineUserId;
        userMapping.lineDisplayName = lineDisplayName;
        userMapping.linePictureUrl = linePictureUrl;

        // Check sessionStorage cache first (instant!)
        const cachedMapping = sessionStorage.getItem(`mapping_${lineUserId}`);
        if (cachedMapping) {
            const cached = JSON.parse(cachedMapping);
            userMapping.tiktokUsername = cached.tiktokUsername;
            userMapping.isLoaded = true;
            console.log('[UserMapping] Loaded from cache (instant):', cached.tiktokUsername);
            return userMapping;
        }

        console.log('[UserMapping] No cache, checking backend for:', lineUserId);

        // Check if mapping exists in backend
        const mapping = await checkUserMapping(lineUserId);

        if (mapping && mapping.success && mapping.tiktokUsername) {
            // User has existing mapping - cache it!
            userMapping.tiktokUsername = mapping.tiktokUsername;
            userMapping.isLoaded = true;

            // Cache for instant load on other pages
            sessionStorage.setItem(`mapping_${lineUserId}`, JSON.stringify({
                tiktokUsername: mapping.tiktokUsername,
                timestamp: Date.now()
            }));

            console.log('[UserMapping] Found mapping and cached:', mapping.tiktokUsername);
        } else {
            // First-time user - show popup to get TikTok username
            console.log('[UserMapping] No mapping found, prompting for TikTok username');
            await promptTikTokUsername();
        }

        return userMapping;

    } catch (error) {
        console.error('[UserMapping] Initialization error:', error);
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
 * Show modal popup to prompt user for TikTok username
 * @returns {Promise<string|null>} TikTok username or null if cancelled
 */
async function promptTikTokUsername() {
    return new Promise((resolve) => {
        // Create modal overlay
        const modalHTML = `
            <div id="tiktok-username-modal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.3s;
            ">
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 20px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    text-align: center;
                    animation: slideUp 0.3s;
                ">
                    <div style="font-size: 3em; margin-bottom: 15px;">👋</div>
                    <h2 style="color: #333; margin-bottom: 10px; font-size: 1.5em;">
                        สวัสดี ${userMapping.lineDisplayName}!
                    </h2>
                    <p style="color: #666; margin-bottom: 20px; font-size: 1em;">
                        กรุณาใส่ TikTok Username ของคุณ<br>
                        เพื่อให้เราจดจำคุณในครั้งถัดไป
                    </p>
                    <input
                        type="text"
                        id="tiktok-username-input"
                        placeholder="@yourtiktok"
                        style="
                            width: 100%;
                            padding: 15px;
                            border: 2px solid #e0e0e0;
                            border-radius: 10px;
                            font-size: 1.1em;
                            margin-bottom: 20px;
                            box-sizing: border-box;
                        "
                    />
                    <button
                        id="save-tiktok-username-btn"
                        style="
                            width: 100%;
                            padding: 15px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            border: none;
                            border-radius: 10px;
                            font-size: 1.1em;
                            font-weight: 600;
                            cursor: pointer;
                        "
                    >
                        บันทึก / Save
                    </button>
                    <p style="color: #999; margin-top: 15px; font-size: 0.9em;">
                        ข้อมูลของคุณจะถูกเก็บไว้อย่างปลอดภัย
                    </p>
                </div>
            </div>
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            </style>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('tiktok-username-modal');
        const input = document.getElementById('tiktok-username-input');
        const saveBtn = document.getElementById('save-tiktok-username-btn');

        // Focus input
        setTimeout(() => input.focus(), 100);

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
                return;
            }

            // Add @ if not present
            const formattedUsername = tiktokUsername.startsWith('@')
                ? tiktokUsername
                : '@' + tiktokUsername;

            // Disable button and show loading
            saveBtn.disabled = true;
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
                modal.innerHTML = `
                    <div style="
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        text-align: center;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    ">
                        <div style="font-size: 4em; margin-bottom: 15px;">✅</div>
                        <h2 style="color: #4CAF50; margin-bottom: 10px;">สำเร็จ!</h2>
                        <p style="color: #666;">บันทึก TikTok Username แล้ว</p>
                    </div>
                `;

                // Close modal after 1.5 seconds
                setTimeout(() => {
                    modal.remove();
                    resolve(formattedUsername);
                }, 1500);
            } else {
                // Save failed
                alert('ไม่สามารถบันทึกได้ กรุณาลองใหม่');
                saveBtn.disabled = false;
                saveBtn.textContent = 'บันทึก / Save';
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
