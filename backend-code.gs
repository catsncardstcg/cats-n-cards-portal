/**
 * Google Apps Script Backend for Cats N Cards Portal
 * LINE LIFF Integration - User Mapping System
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet with these tabs:
 *    - User_Mappings (for LINE ID -> TikTok username mapping)
 *    - Payments (existing)
 *    - Deliveries (existing)
 *    - Points (existing)
 *
 * 2. In User_Mappings sheet, create these columns:
 *    A: LINE User ID
 *    B: TikTok Username
 *    C: LINE Display Name
 *    D: LINE Profile Picture URL
 *    E: Registration Date
 *    F: Last Access Date
 *
 * 3. Copy this entire script to Google Apps Script (Tools > Script Editor)
 * 4. Deploy as Web App (Deploy > New Deployment)
 * 5. Copy the deployment URL and update SCRIPT_URL in all HTML files
 */

// Configuration - UPDATE with your Google Sheet ID
const SPREADSHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';

/**
 * Handle GET requests
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    switch (action) {
      case 'getUserMapping':
        return getUserMapping(e.parameter.lineUserId);

      case 'checkApproval':
        return checkApproval(e.parameter.username);

      case 'getTracking':
        return getTracking();

      case 'getPoints':
        return getPoints(e.parameter.username);

      case 'getPointsHistory':
        return getPointsHistory(e.parameter.username);

      default:
        return createResponse(false, 'Invalid action');
    }
  } catch (error) {
    return createResponse(false, error.message);
  }
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'saveUserMapping':
        return saveUserMapping(data);

      case 'registerAddress':
        return registerAddress(data);

      case 'requestDelivery':
        return requestDelivery(data);

      case 'submitPayment':
        return submitPayment(data);

      case 'redeemReward':
        return redeemReward(data);

      default:
        return createResponse(false, 'Invalid action');
    }
  } catch (error) {
    return createResponse(false, error.message);
  }
}

/**
 * Get user mapping (LINE ID -> TikTok username)
 */
function getUserMapping(lineUserId) {
  if (!lineUserId) {
    return createResponse(false, 'LINE User ID is required');
  }

  const sheet = getSheet('User_Mappings');
  const data = sheet.getDataRange().getValues();

  // Skip header row and search for LINE user ID
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineUserId) {
      // Update last access date
      sheet.getRange(i + 1, 6).setValue(new Date());

      return createResponse(true, 'Mapping found', {
        tiktokUsername: data[i][1],
        lineDisplayName: data[i][2]
      });
    }
  }

  return createResponse(false, 'No mapping found');
}

/**
 * Save user mapping (LINE ID -> TikTok username)
 */
function saveUserMapping(data) {
  const { lineUserId, tiktokUsername, lineDisplayName, lineProfilePictureUrl } = data;

  if (!lineUserId || !tiktokUsername) {
    return createResponse(false, 'LINE User ID and TikTok username are required');
  }

  // Validate TikTok username format
  const formattedUsername = tiktokUsername.startsWith('@') ? tiktokUsername : '@' + tiktokUsername;

  const sheet = getSheet('User_Mappings');
  const existingData = sheet.getDataRange().getValues();

  // Check if mapping already exists
  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][0] === lineUserId) {
      // Update existing mapping
      sheet.getRange(i + 1, 2).setValue(formattedUsername); // Update TikTok username
      sheet.getRange(i + 1, 6).setValue(new Date()); // Update last access date

      return createResponse(true, 'Mapping updated successfully');
    }
  }

  // Create new mapping
  const now = new Date();
  sheet.appendRow([
    lineUserId,
    formattedUsername,
    lineDisplayName || '',
    lineProfilePictureUrl || '',
    now,  // Registration Date
    now   // Last Access Date
  ]);

  return createResponse(true, 'Mapping created successfully');
}

/**
 * Register delivery address (updated to include LINE ID)
 */
function registerAddress(data) {
  const {
    tiktokUsername,
    fullName,
    phone,
    address,
    notes,
    screenshotFileName,
    screenshotData,
    screenshotMimeType,
    lineUserId,
    lineDisplayName,
    linePictureUrl
  } = data;

  // Upload screenshot to Drive
  const screenshotUrl = uploadImageToDrive(
    screenshotData,
    screenshotFileName,
    screenshotMimeType,
    'TikTok Screenshots'
  );

  // Save to Deliveries sheet
  const sheet = getSheet('Address_Registrations');
  sheet.appendRow([
    new Date(),
    tiktokUsername,
    fullName,
    phone,
    address,
    notes || '',
    screenshotUrl,
    'Pending',
    lineUserId || '',
    lineDisplayName || '',
    linePictureUrl || ''
  ]);

  return createResponse(true, 'Registration submitted successfully');
}

/**
 * Request delivery (updated to include LINE ID)
 */
function requestDelivery(data) {
  const {
    tiktokUsername,
    receiptFileName,
    receiptData,
    receiptMimeType,
    lineUserId,
    lineDisplayName,
    linePictureUrl
  } = data;

  // Upload receipt to Drive
  const receiptUrl = uploadImageToDrive(
    receiptData,
    receiptFileName,
    receiptMimeType,
    'Delivery Receipts'
  );

  // Save to Delivery Requests sheet
  const sheet = getSheet('Delivery_Requests');
  sheet.appendRow([
    new Date(),
    tiktokUsername,
    receiptUrl,
    'Pending',
    lineUserId || '',
    lineDisplayName || '',
    linePictureUrl || ''
  ]);

  return createResponse(true, 'Delivery request submitted successfully');
}

/**
 * Submit payment (updated to include LINE ID)
 */
function submitPayment(data) {
  const {
    tiktokUsername,
    amount,
    pointsEarned,
    receiptFileName,
    receiptData,
    receiptMimeType,
    lineUserId,
    lineDisplayName,
    linePictureUrl
  } = data;

  // Upload receipt to Drive
  const receiptUrl = uploadImageToDrive(
    receiptData,
    receiptFileName,
    receiptMimeType,
    'Payment Receipts'
  );

  // Save to Payments sheet
  const sheet = getSheet('Payments');
  sheet.appendRow([
    new Date(),
    tiktokUsername,
    amount,
    pointsEarned,
    receiptUrl,
    'Pending',
    lineUserId || '',
    lineDisplayName || '',
    linePictureUrl || ''
  ]);

  return createResponse(true, 'Payment submitted successfully');
}

/**
 * Check approval status
 */
function checkApproval(username) {
  const sheet = getSheet('Address_Registrations');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username) {
      const status = data[i][7];

      if (status === 'Approved') {
        return createResponse(true, 'User approved', { status: 'approved' });
      } else if (status === 'Rejected') {
        return createResponse(true, 'User rejected', { status: 'rejected' });
      } else {
        return createResponse(true, 'Pending approval', { status: 'pending' });
      }
    }
  }

  return createResponse(true, 'Not registered', { status: 'not_registered' });
}

/**
 * Get tracking numbers
 */
function getTracking() {
  const sheet = getSheet('Tracking_Numbers');
  const data = sheet.getDataRange().getValues();

  const trackingData = [];
  for (let i = 1; i < data.length; i++) {
    trackingData.push({
      date: data[i][0],
      customer: data[i][1],
      tracking: data[i][2],
      carrier: data[i][3]
    });
  }

  return createResponse(true, 'Tracking data retrieved', { data: trackingData });
}

/**
 * Get points for user
 */
function getPoints(username) {
  const sheet = getSheet('Points');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      return createResponse(true, 'Points found', {
        points: data[i][1] || 0,
        lifetimePoints: data[i][2] || 0
      });
    }
  }

  return createResponse(false, 'Username not found');
}

/**
 * Get points history
 */
function getPointsHistory(username) {
  const sheet = getSheet('Points_History');
  const data = sheet.getDataRange().getValues();

  const history = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      history.push({
        date: data[i][1],
        reason: data[i][2],
        points: data[i][3]
      });
    }
  }

  return createResponse(true, 'History retrieved', { history: history });
}

/**
 * Redeem reward
 */
function redeemReward(data) {
  const { username, points, reward } = data;

  const sheet = getSheet('Reward_Redemptions');
  sheet.appendRow([
    new Date(),
    username,
    reward,
    points,
    'Pending'
  ]);

  return createResponse(true, 'Redemption request submitted');
}

/**
 * Helper: Get sheet by name
 */
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);

    // Add headers based on sheet name
    if (sheetName === 'User_Mappings') {
      sheet.appendRow([
        'LINE User ID',
        'TikTok Username',
        'LINE Display Name',
        'LINE Profile Picture URL',
        'Registration Date',
        'Last Access Date'
      ]);
    }
  }

  return sheet;
}

/**
 * Helper: Upload image to Google Drive
 */
function uploadImageToDrive(base64Data, fileName, mimeType, folderName) {
  try {
    // Decode base64
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      mimeType,
      fileName
    );

    // Get or create folder
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    // Upload file
    const file = folder.createFile(blob);

    // Set sharing permissions
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return file.getUrl();
  } catch (error) {
    Logger.log('Error uploading image: ' + error.message);
    return 'Error uploading image';
  }
}

/**
 * Helper: Create JSON response
 */
function createResponse(success, message, data) {
  const response = {
    success: success,
    message: message
  };

  if (data) {
    Object.assign(response, data);
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
