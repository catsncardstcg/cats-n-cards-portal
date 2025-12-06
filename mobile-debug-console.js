/**
 * Mobile Debug Console - Shows logs on screen for debugging without console access
 */

// Create debug console on page
function createDebugConsole() {
    // Remove existing debug console if any
    const existing = document.getElementById('mobile-debug-console');
    if (existing) existing.remove();

    // Create debug console
    const debugDiv = document.createElement('div');
    debugDiv.id = 'mobile-debug-console';
    debugDiv.style.cssText = `
        position: fixed;
        top: 50px;
        right: 10px;
        width: 300px;
        max-height: 400px;
        background: rgba(0,0,0,0.95);
        color: #fff;
        border: 2px solid #f00;
        border-radius: 10px;
        padding: 10px;
        font-family: monospace;
        font-size: 11px;
        z-index: 999999;
        overflow-y: auto;
        display: block;
    `;

    debugDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #fff; padding-bottom: 5px;">
            <strong>🔍 DEBUG CONSOLE</strong>
            <button onclick="document.getElementById('mobile-debug-console').remove()" style="background: #f00; color: #fff; border: none; padding: 2px 8px; border-radius: 3px; cursor: pointer;">X</button>
        </div>
        <div id="debug-log-container"></div>
    `;

    document.body.appendChild(debugDiv);
    return debugDiv;
}

// Hijack console.log and console.error to show on screen
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const MAX_LOG_ENTRIES = 50;
const logEntries = [];

function addLogEntry(type, message, ...args) {
    // Create log entry
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        timestamp: timestamp,
        type: type,
        message: message,
        args: args
    };

    // Add to array (keep only last MAX_LOG_ENTRIES)
    logEntries.unshift(logEntry);
    if (logEntries.length > MAX_LOG_ENTRIES) {
        logEntries.pop();
    }

    // Update display
    updateDebugDisplay();
}

function updateDebugDisplay() {
    const container = document.getElementById('debug-log-container');
    if (!container) return;

    const logHtml = logEntries.map(entry => {
        let color = '#fff';
        let icon = '📝';

        if (entry.type === 'error') {
            color = '#ff6b6b';
            icon = '❌';
        } else if (entry.type === 'warn') {
            color = '#ffd93d';
            icon = '⚠️';
        } else if (entry.message.includes('[Firebase]') || entry.message.includes('[Firebase Config]')) {
            color = '#6bff6b';
            icon = '🔥';
        } else if (entry.message.includes('[Receipt Upload]')) {
            color = '#6bdfff';
            icon = '📤';
        }

        const fullMessage = entry.message +
            (entry.args.length > 0 ? ' ' + JSON.stringify(entry.args) : '');

        return `<div style="color: ${color}; margin-bottom: 3px; font-size: 10px; word-break: break-word;">
            <span style="opacity: 0.7">${entry.timestamp}</span> ${icon} ${fullMessage}
        </div>`;
    }).join('');

    container.innerHTML = logHtml;
}

// Override console methods
console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    addLogEntry('log', args[0], args.slice(1));
};

console.error = function(...args) {
    originalConsoleError.apply(console, args);
    addLogEntry('error', args[0], args.slice(1));
};

console.warn = function(...args) {
    originalConsoleWarn.apply(console, args);
    addLogEntry('warn', args[0], args.slice(1));
};

// Auto-create debug console after page load
setTimeout(() => {
    createDebugConsole();
}, 1000);