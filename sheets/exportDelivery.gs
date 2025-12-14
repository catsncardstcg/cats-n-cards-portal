/**
 * Google Apps Script for exporting delivery data from Cats N Cards Admin Dashboard
 *
 * This script handles the export of shipping orders to Google Sheets
 * for delivery management and tracking purposes.
 *
 * Deployment Instructions:
 * 1. Open Google Apps Script (script.google.com)
 * 2. Create a new script project
 * 3. Copy this code into the script editor
 * 4. Deploy as Web App
 * 5. Set "Execute as" to "Me" and "Who has access" to "Anyone"
 * 6. Copy the Web App URL and update it in admin/script.js
 */

// Configuration
const CONFIG = {
  SHEET_NAME: 'Deliveries',
  HEADERS: [
    'Order ID',
    'Date',
    'Customer Name',
    'Phone',
    'Address',
    'Province',
    'Postal Code',
    'TikTok Username',
    'Amount',
    'Points',
    'Delivery Round',
    'Tracking Number',
    'Status',
    'Notes'
  ],
  PROVINCES: [
    'กรุงเทพมหานคร',
    'สมุทรปราการ',
    'นนทบุรี',
    'ปทุมธานี',
    'พระนคร',
    'อยุธยา',
    'ราชบุรี',
    'จันทบุรี',
    'ฉะเชิงเทรา',
    'ชลบุรี',
    'เชียงใหม่',
    'หาดใหญ่',
    'ลำปาง',
    'ลำพูน',
    'แม่ฮ่องสอน',
    'ร้อยเอียด',
    'กาญจนบุรี',
    'กาฬสินธุ',
    'เพชรบุรี',
    'นครนายก',
    'นครปฐม',
    'นครสวรรค์',
    'นราธิวาส',
    'ปัตตานี',
    'พังงา',
    'พิษณุโลก',
    'เพชรบูรณ์',
    'แพร่',
    'ภูเก็ต',
    'มหาสารคาม',
    'มุกดาหาร',
    'ยะลา',
    'ยโสธร',
    'ระนอง',
    'ระยอง',
    'สกลนคร',
    'สงขลา',
    'สตูล',
    'สุพรรณบุรี',
    'สุราษฎร์ธานี',
    'สุรินทร์',
    'อุตรดิตถ์',
    'อุดรธานี',
    'อุทัยธานี',
    'อำนาจเจริญ'
  ]
};

/**
 * Main function to handle POST requests from admin dashboard
 * This is the webhook endpoint that receives order data
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const orders = data.orders || [];

    if (orders.length === 0) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'No orders provided'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Export to Google Sheets
    const result = exportOrdersToSheet(orders);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Export orders to Google Sheets
 */
function exportOrdersToSheet(orders) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);

      // Set up headers
      sheet.getRange(1, 1, 1, CONFIG.HEADERS.length)
        .setValues([CONFIG.HEADERS])
        .setFontWeight('bold')
        .setBackground('#4F46E5')
        .setFontColor('white');

      // Auto-resize columns
      sheet.autoResizeColumns(1, CONFIG.HEADERS.length);
    }

    // Clear existing data (keep headers)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length).clearContent();
    }

    // Prepare rows for export
    const rows = orders.map(order => prepareOrderRow(order));

    if (rows.length > 0) {
      // Add new data
      sheet.getRange(2, 1, rows.length, CONFIG.HEADERS.length)
        .setValues(rows);

      // Apply conditional formatting
      applyConditionalFormatting(sheet, rows.length);

      // Auto-resize columns again after data is added
      sheet.autoResizeColumns(1, CONFIG.HEADERS.length);

      // Freeze header row
      sheet.setFrozenRows(1);
    }

    // Log export activity
    logExportActivity(orders.length);

    return {
      success: true,
      count: rows.length,
      message: `Successfully exported ${rows.length} orders`
    };

  } catch (error) {
    console.error('Error exporting orders:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Prepare order data for sheet export
 */
function prepareOrderRow(order) {
  const deliveryAddress = order.deliveryAddress || {};
  const deliveryDate = new Date(order.createdAt || order.verifiedAt);

  return [
    order.id || '',
    deliveryDate.toLocaleDateString('th-TH'),
    deliveryAddress.fullName || '',
    deliveryAddress.phone || '',
    deliveryAddress.address || '',
    deliveryAddress.province || '',
    deliveryAddress.postalCode || '',
    order.tiktokUsername || '',
    order.amount || 0,
    order.pointsEarned || 0,
    order.deliveryRound || '',
    order.trackingNumber || '',
    getStatusDisplayText(order.status),
    deliveryAddress.notes || order.adminNotes || ''
  ];
}

/**
 * Apply conditional formatting to the sheet
 */
function applyConditionalFormatting(sheet, rowCount) {
  const dataRange = sheet.getRange(2, 1, rowCount, CONFIG.HEADERS.length);

  // Clear existing conditional formatting
  sheet.clearConditionalFormatRules();

  const rules = [];

  // Format for ready_to_ship status
  const readyToShipRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('พร้อมจัดส่ง')
    .setBackground('#D1FAE5')
    .setFontColor('#065F46')
    .setRanges([dataRange])
    .build();
  rules.push(readyToShipRule);

  // Format for shipped status
  const shippedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('จัดส่งแล้ว')
    .setBackground('#DBEAFE')
    .setFontColor('#1E40AF')
    .setRanges([dataRange])
    .build();
  rules.push(shippedRule);

  // Format for rejected status
  const rejectedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('ปฏิเสธ')
    .setBackground('#FEE2E2')
    .setFontColor('#991B1B')
    .setRanges([dataRange])
    .build();
  rules.push(rejectedRule);

  // Format for high amounts (>1000 THB)
  const highAmountRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(1000)
    .setBackground('#FEF3C7')
    .setFontColor('#92400E')
    .setRanges([sheet.getRange(2, 9, rowCount, 1)]) // Amount column
    .build();
  rules.push(highAmountRule);

  // Apply all rules
  sheet.setConditionalFormatRules(rules);
}

/**
 * Get display text for status
 */
function getStatusDisplayText(status) {
  const statusMap = {
    'pending_address': 'รอกรอกที่อยู่',
    'ready_to_ship': 'พร้อมจัดส่ง',
    'shipped': 'จัดส่งแล้ว',
    'rejected': 'ปฏิเสธ',
    'pending_check': 'รอตรวจสอบ'
  };

  return statusMap[status] || status || 'Unknown';
}

/**
 * Log export activity for tracking
 */
function logExportActivity(orderCount) {
  try {
    const logSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName('Export Log') ||
      SpreadsheetApp.getActiveSpreadsheet().insertSheet('Export Log');

    if (logSheet.getLastRow() === 0) {
      logSheet.getRange(1, 1, 1, 4).setValues([
        ['Export Date', 'Order Count', 'Exported By', 'Notes']
      ]).setFontWeight('bold');
    }

    logSheet.appendRow([
      new Date(),
      orderCount,
      Session.getActiveUser().getEmail(),
      'Admin Dashboard Export'
    ]);
  } catch (error) {
    console.log('Could not log export activity:', error);
  }
}

/**
 * Helper function to validate required fields
 */
function validateOrder(order) {
  const required = ['id', 'deliveryAddress'];
  const missing = required.filter(field => !order[field]);

  if (missing.length > 0) {
    console.warn('Order missing required fields:', missing, order.id);
    return false;
  }

  return true;
}

/**
 * Create a summary report of exported orders
 */
function createSummaryReport() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet || sheet.getLastRow() === 1) {
      SpreadsheetApp.getUi().alert('No data to summarize');
      return;
    }

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, CONFIG.HEADERS.length).getValues();

    const summary = {
      totalOrders: data.length,
      totalAmount: data.reduce((sum, row) => sum + (row[8] || 0), 0),
      totalPoints: data.reduce((sum, row) => sum + (row[9] || 0), 0),
      provinces: {},
      statusCounts: {}
    };

    // Count by province
    data.forEach(row => {
      const province = row[5] || 'Unknown';
      summary.provinces[province] = (summary.provinces[province] || 0) + 1;
    });

    // Count by status
    data.forEach(row => {
      const status = row[12] || 'Unknown';
      summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
    });

    // Create summary sheet
    const summarySheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName('Summary') ||
      SpreadsheetApp.getActiveSpreadsheet().insertSheet('Summary');

    summarySheet.clear();

    // Write summary data
    summarySheet.getRange(1, 1, 1, 1).setValue('Delivery Summary Report')
      .setFontWeight('bold')
      .setFontSize(16);

    let row = 3;

    summarySheet.getRange(row, 1, 1, 2).setValues([
      ['Total Orders:', summary.totalOrders]
    ]).setFontWeight('bold');

    row++;
    summarySheet.getRange(row, 1, 1, 2).setValues([
      ['Total Amount:', `฿${summary.totalAmount.toLocaleString()}`]
    ]).setFontWeight('bold');

    row++;
    summarySheet.getRange(row, 1, 1, 2).setValues([
      ['Total Points:', summary.totalPoints.toLocaleString()]
    ]).setFontWeight('bold');

    // Province breakdown
    row += 2;
    summarySheet.getRange(row, 1, 1, 1).setValue('Orders by Province:')
      .setFontWeight('bold');

    row++;
    Object.entries(summary.provinces).forEach(([province, count]) => {
      summarySheet.getRange(row, 1, 1, 2).setValues([[province, count]]);
      row++;
    });

    // Status breakdown
    row += 2;
    summarySheet.getRange(row, 1, 1, 1).setValue('Orders by Status:')
      .setFontWeight('bold');

    row++;
    Object.entries(summary.statusCounts).forEach(([status, count]) => {
      summarySheet.getRange(row, 1, 1, 2).setValues([[status, count]]);
      row++;
    });

    SpreadsheetApp.getUi().alert('Summary report created successfully');

  } catch (error) {
    console.error('Error creating summary report:', error);
    SpreadsheetApp.getUi().alert('Error creating summary report');
  }
}

/**
 * Menu function to create summary report
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Delivery Export')
    .addItem('Create Summary Report', 'createSummaryReport')
    .addToUi();
}