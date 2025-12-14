// Google Apps Script - Complete Backend for Cats N Cards TCG Portal
// This script handles: Registration + Approval, Points System, Delivery, Tracking

// ==================== CONFIGURATION ====================
// UPDATE THESE with your Google Sheets IDs and Drive folder ID

const CONFIG = {
  // REGISTRATION & APPROVAL
  REGISTRATION_SHEET_ID: '1iJEZpUZVafjTTcUZLwljgTDQmeJ8O6rNzLbSg0grfbY',
  REGISTRATION_SHEET_NAME: 'Registrations',
  
  // POINTS SYSTEM
  POINTS_SHEET_ID: '1blNYc2-cebQ7G4uxFk05tF463JVAivSOhHf9yOM8HYA',
  POINTS_LEDGER_SHEET_NAME: 'Points Ledger',
  POINTS_HISTORY_SHEET_NAME: 'Points History',
  REDEMPTION_SHEET_NAME: 'Redemptions',
  
  // DELIVERY REQUESTS
  DELIVERY_SHEET_ID: '13EToqth7ZU9qxyntif9Mlg3WKLjj-RUmXLZxZtIvmKc',
  DELIVERY_SHEET_NAME: 'Delivery Requests',
  
  // TRACKING NUMBERS (existing)
  TRACKING_SHEET_ID: '1-8MtNwTpTJz0I5vSVRwY_EiL4Qk71unLjBiEIudDDgM/edit?gid=224908477',
  TRACKING_SHEET_NAME: 'Tracking',
  
  // GOOGLE DRIVE FOLDERS
  SCREENSHOTS_FOLDER_ID: '1eQWb4MgifCXS_32pmTkmkDoEs2ccI8yy',
  RECEIPTS_FOLDER_ID: '1yJGCqCcW0P5sZLi_3uy9Ne6noqwIGgJ1',
  
  // POINTS CONFIGURATION
  POINTS_PER_THB: 250  // 250 THB = 1 point
};

// ==================== MAIN HANDLERS ====================

// Handle GET requests
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getTracking') {
      return getTrackingNumbers();
    } else if (action === 'checkApproval') {
      return checkUserApproval(e.parameter.username);
    } else if (action === 'getPoints') {
      return getUserPoints(e.parameter.username);
    } else if (action === 'getPointsHistory') {
      return getPointsHistory(e.parameter.username);
    } else if (action === 'checkRegistration') {
      return checkRegistration(e.parameter.lineUserId);
    }
    
    return jsonResponse(false, 'Invalid action');
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

// Handle POST requests
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'registerAddress') {
      return registerWithScreenshot(data);
    } else if (data.action === 'requestDelivery') {
      return requestDelivery(data);
    } else if (data.action === 'redeemReward') {
      return redeemReward(data);
    } else if (data.action === 'submitDeliveryRequest') {
      return createDeliveryWithoutRegistration(data);
    } else if (data.action === 'updateAddress') {
      return updateAddress(data.deliveryId, data);
    }

    return jsonResponse(false, 'Invalid action');
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

// ==================== REGISTRATION & APPROVAL ====================

function registerWithScreenshot(data) {
  try {
    // Check if username already registered
    const regSheet = getOrCreateSheet(CONFIG.REGISTRATION_SHEET_ID, CONFIG.REGISTRATION_SHEET_NAME);
    
    // Initialize headers if needed
    if (regSheet.getLastRow() === 0) {
      regSheet.appendRow([
        'Timestamp',
        'TikTok Username',
        'Full Name',
        'Phone',
        'Address',
        'Notes',
        'Screenshot URL',
        'Status',
        'Admin Notes'
      ]);
    }
    
    // Check for existing registration
    const dataRange = regSheet.getDataRange().getValues();
    for (let i = 1; i < dataRange.length; i++) {
      if (dataRange[i][1] === data.tiktokUsername) {
        return jsonResponse(false, 'This TikTok username is already registered. Please contact us if you need to update your information.');
      }
    }
    
    // Upload screenshot to Drive
    let screenshotUrl = '';
    if (data.screenshotData) {
      const folder = DriveApp.getFolderById(CONFIG.SCREENSHOTS_FOLDER_ID);
      const blob = Utilities.newBlob(
        Utilities.base64Decode(data.screenshotData),
        data.screenshotMimeType,
        `${data.tiktokUsername}_${data.screenshotFileName}`
      );
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      screenshotUrl = file.getUrl();
    }
    
    // Save registration
    regSheet.appendRow([
      new Date(),
      data.tiktokUsername,
      data.fullName,
      data.phone,
      data.address,
      data.notes || '',
      screenshotUrl,
      'Pending',
      ''
    ]);
    
    return jsonResponse(true, 'Registration submitted for approval');
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

function checkUserApproval(username) {
  try {
    const regSheet = SpreadsheetApp.openById(CONFIG.REGISTRATION_SHEET_ID)
      .getSheetByName(CONFIG.REGISTRATION_SHEET_NAME);
    
    if (!regSheet || regSheet.getLastRow() === 0) {
      return jsonResponse(true, null, { status: 'not_registered' });
    }
    
    const dataRange = regSheet.getDataRange().getValues();
    
    // Find user
    for (let i = 1; i < dataRange.length; i++) {
      if (dataRange[i][1] === username) {
        const status = dataRange[i][7].toString().toLowerCase();
        
        if (status === 'approved') {
          return jsonResponse(true, null, { status: 'approved' });
        } else if (status === 'rejected') {
          return jsonResponse(true, null, { status: 'rejected' });
        } else {
          return jsonResponse(true, null, { status: 'pending' });
        }
      }
    }
    
    return jsonResponse(true, null, { status: 'not_registered' });
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

// ==================== POINTS SYSTEM ====================

function getUserPoints(username) {
  try {
    const pointsSheet = getOrCreateSheet(CONFIG.POINTS_SHEET_ID, CONFIG.POINTS_LEDGER_SHEET_NAME);
    
    // Initialize if needed
    if (pointsSheet.getLastRow() === 0) {
      pointsSheet.appendRow([
        'TikTok Username',
        'Current Points',
        'Lifetime Points',
        'Last Updated'
      ]);
    }
    
    const dataRange = pointsSheet.getDataRange().getValues();
    
    // Find user
    for (let i = 1; i < dataRange.length; i++) {
      if (dataRange[i][0] === username) {
        return jsonResponse(true, null, {
          points: dataRange[i][1] || 0,
          lifetimePoints: dataRange[i][2] || 0
        });
      }
    }
    
    // User not found = 0 points
    return jsonResponse(true, null, { points: 0, lifetimePoints: 0 });
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

function getPointsHistory(username) {
  try {
    const historySheet = getOrCreateSheet(CONFIG.POINTS_SHEET_ID, CONFIG.POINTS_HISTORY_SHEET_NAME);
    
    if (historySheet.getLastRow() === 0) {
      return jsonResponse(true, null, { history: [] });
    }
    
    const dataRange = historySheet.getDataRange().getValues();
    const history = [];
    
    // Find all entries for this user
    for (let i = 1; i < dataRange.length; i++) {
      if (dataRange[i][0] === username) {
        history.push({
          date: formatDate(dataRange[i][1]),
          points: dataRange[i][2],
          reason: dataRange[i][3]
        });
      }
    }
    
    return jsonResponse(true, null, { history: history });
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

function redeemReward(data) {
  try {
    // Check if user has enough points
    const pointsSheet = getOrCreateSheet(CONFIG.POINTS_SHEET_ID, CONFIG.POINTS_LEDGER_SHEET_NAME);
    const dataRange = pointsSheet.getDataRange().getValues();
    
    let userRow = -1;
    let currentPoints = 0;
    
    for (let i = 1; i < dataRange.length; i++) {
      if (dataRange[i][0] === data.username) {
        userRow = i + 1;
        currentPoints = dataRange[i][1] || 0;
        break;
      }
    }
    
    if (userRow === -1) {
      return jsonResponse(false, 'User not found in points system');
    }
    
    if (currentPoints < data.points) {
      return jsonResponse(false, 'Insufficient points');
    }
    
    // Save redemption request
    const redemptionSheet = getOrCreateSheet(CONFIG.POINTS_SHEET_ID, CONFIG.REDEMPTION_SHEET_NAME);
    
    if (redemptionSheet.getLastRow() === 0) {
      redemptionSheet.appendRow([
        'Timestamp',
        'TikTok Username',
        'Points Used',
        'Reward',
        'Status'
      ]);
    }
    
    redemptionSheet.appendRow([
      new Date(),
      data.username,
      data.points,
      data.reward,
      'Pending'
    ]);
    
    return jsonResponse(true, 'Redemption request submitted. We will contact you soon!');
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

// ==================== DELIVERY SYSTEM ====================

function requestDelivery(data) {
  try {
    // Get user info from registrations
    const regSheet = SpreadsheetApp.openById(CONFIG.REGISTRATION_SHEET_ID)
      .getSheetByName(CONFIG.REGISTRATION_SHEET_NAME);
    
    let userInfo = null;
    const regData = regSheet.getDataRange().getValues();
    
    for (let i = 1; i < regData.length; i++) {
      if (regData[i][1] === data.tiktokUsername && regData[i][7] === 'Approved') {
        userInfo = {
          name: regData[i][2],
          phone: regData[i][3],
          address: regData[i][4]
        };
        break;
      }
    }
    
    if (!userInfo) {
      return jsonResponse(false, 'User not approved for delivery');
    }
    
    // Upload receipt
    let receiptUrl = '';
    if (data.receiptData) {
      const folder = DriveApp.getFolderById(CONFIG.RECEIPTS_FOLDER_ID);
      const blob = Utilities.newBlob(
        Utilities.base64Decode(data.receiptData),
        data.receiptMimeType,
        `${data.tiktokUsername}_${data.receiptFileName}`
      );
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      receiptUrl = file.getUrl();
    }
    
    // Save delivery request
    const deliverySheet = getOrCreateSheet(CONFIG.DELIVERY_SHEET_ID, CONFIG.DELIVERY_SHEET_NAME);
    
    if (deliverySheet.getLastRow() === 0) {
      deliverySheet.appendRow([
        'Timestamp',
        'TikTok Username',
        'Name',
        'Phone',
        'Address',
        'Receipt URL',
        'Status'
      ]);
    }
    
    deliverySheet.appendRow([
      new Date(),
      data.tiktokUsername,
      userInfo.name,
      userInfo.phone,
      userInfo.address,
      receiptUrl,
      'Pending'
    ]);
    
    return jsonResponse(true, 'Delivery request submitted');
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

// ==================== TRACKING NUMBERS ====================

function getTrackingNumbers() {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.TRACKING_SHEET_ID)
      .getSheetByName(CONFIG.TRACKING_SHEET_NAME);
    
    const data = sheet.getDataRange().getValues();
    const trackingData = [];
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] || data[i][1] || data[i][2]) {
        trackingData.push({
          date: formatDate(data[i][0]),
          customer: data[i][1] || '',
          tracking: data[i][2] || '',
          carrier: data[i][3] || ''
        });
      }
    }
    
    return jsonResponse(true, null, { data: trackingData });
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

// ==================== HELPER FUNCTIONS ====================

function getOrCreateSheet(spreadsheetId, sheetName) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  
  return sheet;
}

function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  
  if (date instanceof Date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return '';
}

function jsonResponse(success, message, data) {
  const response = { success: success };
  
  if (message) response.message = message;
  if (data) Object.assign(response, data);
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== ADMIN HELPER FUNCTIONS ====================

// These functions can be run manually from the script editor to manage the system

// Add points to a user (run manually after each purchase)
function addPointsToUser(username, thbAmount, reason) {
  const points = Math.floor(thbAmount / CONFIG.POINTS_PER_THB);
  
  if (points === 0) return;
  
  const pointsSheet = getOrCreateSheet(CONFIG.POINTS_SHEET_ID, CONFIG.POINTS_LEDGER_SHEET_NAME);
  const historySheet = getOrCreateSheet(CONFIG.POINTS_SHEET_ID, CONFIG.POINTS_HISTORY_SHEET_NAME);
  
  // Initialize history sheet if needed
  if (historySheet.getLastRow() === 0) {
    historySheet.appendRow(['TikTok Username', 'Date', 'Points', 'Reason', 'Running Total']);
  }
  
  const dataRange = pointsSheet.getDataRange().getValues();
  let userRow = -1;
  let currentPoints = 0;
  let lifetimePoints = 0;
  
  // Find user
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0] === username) {
      userRow = i + 1;
      currentPoints = dataRange[i][1] || 0;
      lifetimePoints = dataRange[i][2] || 0;
      break;
    }
  }
  
  const newCurrent = currentPoints + points;
  const newLifetime = lifetimePoints + points;
  
  if (userRow === -1) {
    // New user
    pointsSheet.appendRow([username, points, points, new Date()]);
  } else {
    // Update existing user
    pointsSheet.getRange(userRow, 2).setValue(newCurrent);
    pointsSheet.getRange(userRow, 3).setValue(newLifetime);
    pointsSheet.getRange(userRow, 4).setValue(new Date());
  }
  
  // Add to history
  historySheet.appendRow([
    username,
    new Date(),
    points,
    reason || `Purchase: ${thbAmount} THB`,
    newCurrent
  ]);
  
  Logger.log(`Added ${points} points to ${username}. New balance: ${newCurrent}`);
}

// Approve a redemption (run manually after fulfilling the reward)
function approveRedemption(username, pointsToDeduct) {
  const pointsSheet = getOrCreateSheet(CONFIG.POINTS_SHEET_ID, CONFIG.POINTS_LEDGER_SHEET_NAME);
  const historySheet = getOrCreateSheet(CONFIG.POINTS_SHEET_ID, CONFIG.POINTS_HISTORY_SHEET_NAME);
  
  const dataRange = pointsSheet.getDataRange().getValues();
  let userRow = -1;
  let currentPoints = 0;
  
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0] === username) {
      userRow = i + 1;
      currentPoints = dataRange[i][1] || 0;
      break;
    }
  }
  
  if (userRow === -1 || currentPoints < pointsToDeduct) {
    Logger.log('Error: User not found or insufficient points');
    return;
  }
  
  const newCurrent = currentPoints - pointsToDeduct;
  
  pointsSheet.getRange(userRow, 2).setValue(newCurrent);
  pointsSheet.getRange(userRow, 4).setValue(new Date());
  
  historySheet.appendRow([
    username,
    new Date(),
    -pointsToDeduct,
    'Redeemed reward',
    newCurrent
  ]);
  
  Logger.log(`Deducted ${pointsToDeduct} points from ${username}. New balance: ${newCurrent}`);
}
// Check if user exists in system
function checkRegistration(lineUserId) {
  try {
    const sheet = SpreadsheetApp.openById('1iJEZpUZVafjTTcUZLwljgTDQmeJ8O6rNzLbSg0grfbY')
      .getSheetByName('User_Mappings');

    if (!sheet || sheet.getLastRow() === 0) {
      return jsonResponse(true, null, { exists: false });
    }

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === lineUserId) {
        return jsonResponse(true, null, {
          exists: true,
          userData: {
            fullName: data[i][2],
            phone: data[i][3],
            address: data[i][4],
            registeredAt: data[i][5]
          }
        });
      }
    }

    return jsonResponse(true, null, { exists: false });
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

// ==================== DELIVERY MANAGEMENT ====================

// Create delivery without registration requirement
function createDeliveryWithoutRegistration(data) {
  try {
    const deliverySheet = getOrCreateSheet('13EToqth7ZU9qxyntif9Mlg3WKLjj-RUmXLZxZtIvmKc', 'Delivery_Requests');

    if (deliverySheet.getLastRow() === 0) {
      deliverySheet.appendRow([
        'Timestamp', 'LINE User ID', 'TikTok Username', 'LINE Display Name',
        'Phone', 'Address', 'Receipt URL', 'Status', 'Tracking Number',
        'Delivery Round', 'SubmittedAt', 'ProcessedAt', 'DeliveredAt'
      ]);
    }

    // Upload receipt to Drive
    let receiptUrl = '';
    if (data.receiptData) {
      const folder = DriveApp.getFolderById('1yJGCqCcW0P5sZLi_3uy9Ne6noqwIGgJ1');
      const blob = Utilities.newBlob(
        Utilities.base64Decode(data.receiptData),
        data.receiptMimeType,
        `delivery_${data.lineUserId}_${Date.now()}`
      );
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      receiptUrl = file.getUrl();
    }

    // Generate tracking number
    const trackingNumber = generateTrackingNumber();

    const deliveryRound = data.deliveryRound || getNextDeliveryRound();

    deliverySheet.appendRow([
      new Date(),
      data.lineUserId,
      data.tiktokUsername,
      data.lineDisplayName,
      data.phone || '',
      data.address || '',
      receiptUrl,
      'Pending',
      trackingNumber,
      deliveryRound.dayEng,
      data.submittedAt,
      '', // ProcessedAt
      ''  // DeliveredAt
    ]);

    return jsonResponse(true, 'Delivery request submitted successfully', {
      trackingNumber: trackingNumber,
      deliveryRound: deliveryRound
    });

  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

// Update existing delivery address
function updateAddress(deliveryId, addressData) {
  try {
    const sheet = SpreadsheetApp.openById('13EToqth7ZU9qxyntif9Mlg3WKLjj-RUmXLZxZtIvmKc')
      .getSheetByName('Address_Registrations');

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === deliveryId) {
        // Update address fields
        sheet.getRange(i + 1, 2).setValue(addressData.fullName);
        sheet.getRange(i + 1, 3).setValue(addressData.phone);
        sheet.getRange(i + 1, 4).setValue(addressData.address);
        sheet.getRange(i + 1, 5).setValue(addressData.notes);
        sheet.getRange(i + 1, 7).setValue(new Date()); // UpdatedAt

        return jsonResponse(true, 'Address updated successfully');
      }
    }

    return jsonResponse(false, 'Delivery not found');
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

// Generate automatic tracking number
function generateTrackingNumber() {
  const prefix = 'CC';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

// Get next delivery round
function getNextDeliveryRound() {
  const rounds = [
    { dayTh: 'จันทร์', dayEng: 'Monday' },
    { dayTh: 'อังคาร', dayEng: 'Tuesday' },
    { dayTh: 'พุธ', dayEng: 'Wednesday' },
    { dayTh: 'พฤหัสบดี', dayEng: 'Thursday' },
    { dayTh: 'ศุกร์', dayEng: 'Friday' },
    { dayTh: 'เสาร์', dayEng: 'Saturday' },
    { dayTh: 'อาทิตย์', dayEng: 'Sunday' }
  ];

  const today = new Date().getDay();
  return rounds[today];
}

// Add points to user (enhanced for new flow)
function addPointsForDelivery(lineUserId, thbAmount, reason) {
  const points = Math.floor(thbAmount / CONFIG.POINTS_PER_THB);

  if (points === 0) return;

  const sheet = getOrCreateSheet('1blNYc2-cebQ7G4uxFk05tF463JVAivSOhHf9yOM8HYA', 'Points_Ledger');

  // Find or create user entry
  const dataRange = sheet.getDataRange().getValues();
  let userRow = -1;
  let currentPoints = 0;

  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0] === lineUserId) {
      userRow = i + 1;
      currentPoints = dataRange[i][1] || 0;
      break;
    }
  }

  const newPoints = currentPoints + points;

  if (userRow === -1) {
    // New user
    sheet.appendRow([lineUserId, points, new Date()]);
  } else {
    // Update existing user
    sheet.getRange(userRow, 2).setValue(newPoints);
    sheet.getRange(userRow, 3).setValue(new Date());
  }

  // Add to history
  const historySheet = getOrCreateSheet('1blNYc2-cebQ7G4uxFk05tF463JVAivSOhHf9yOM8HYA', 'Points_History');
  historySheet.appendRow([lineUserId, new Date(), points, reason, newPoints]);
}

// ==================== SETUP INSTRUCTIONS ====================

/*
COMPLETE SETUP GUIDE:

1. CREATE GOOGLE SHEETS (4 sheets total):
   
   A) REGISTRATION SHEET:
      - Create a new Google Sheet
      - Name it "Customer Registrations"
      - Copy the Sheet ID from URL
   
   B) POINTS SHEET:
      - Create a new Google Sheet
      - Will auto-create 3 tabs: Points Ledger, Points History, Redemptions
      - Copy the Sheet ID
   
   C) DELIVERY SHEET:
      - Create a new Google Sheet
      - Name it "Delivery Requests"
      - Copy the Sheet ID
   
   D) TRACKING SHEET:
      - Use your existing tracking sheet
      - Make sure columns are: วันที่ส่ง | ชื่อลูกค้า | เลขพัสดุ | ขนส่ง

2. CREATE GOOGLE DRIVE FOLDERS (2 folders):
   
   - Screenshots folder (for TikTok profile screenshots)
   - Receipts folder (for payment receipts)
   - Get folder IDs from URLs

3. UPDATE CONFIG:
   - Fill in all the IDs in the CONFIG object above

4. DEPLOY WEB APP:
   - Deploy > New deployment
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
   - Copy the Web App URL

5. UPDATE HTML FILES:
   - Replace SCRIPT_URL in delivery.html and points.html

6. DAILY WORKFLOW:
   
   APPROVING REGISTRATIONS:
   - Open Registrations sheet
   - Check screenshot + TikTok profile
   - Change Status to "Approved" or "Rejected"
   
   ADDING POINTS AFTER PURCHASE:
   - Open Script Editor
   - Run: addPointsToUser("@username", 500, "Purchase from livestream")
   - This adds points based on amount spent
   
   PROCESSING DELIVERIES:
   - Check Delivery Requests sheet
   - Verify payment receipt
   - Ship items
   - Add tracking to Tracking sheet
   
   APPROVING REDEMPTIONS:
   - Check Redemptions sheet
   - Fulfill the reward
   - Run: approveRedemption("@username", 10)
   - Update Status to "Completed"

TROUBLESHOOTING:
- Permission errors: Re-authorize the script
- Uploads failing: Check folder IDs and permissions
- Points not calculating: Check POINTS_PER_THB setting
*/