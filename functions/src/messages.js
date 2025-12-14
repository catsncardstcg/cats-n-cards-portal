/**
 * LINE Bot Messages Configuration
 * Central place for all user-facing messages
 */

module.exports = {
  // TikTok linking messages
  tikTokLinking: {
    welcomeFirstTime: 'ยินดีต้อนรับสู่ Cats N Cards!\n\n' +
                     'กรุณาผูกบัญชี TikTok ก่อนเริ่มใช้งาน\n\n' +
                     'พิมพ์ TikTok username พร้อม @ นำหน้า\n' +
                     'เช่น: @myusername, @user_name\n\n' +
                     'หลังจากผูกบัญชีแล้ว สามารถส่งสลิปได้เลยครับ',

    welcomeReturn: (tiktokUsername) =>
      `ยินดีต้อนรับกลับสู่ Cats N Cards!\n\n` +
      `บัญชีนี้ผูกกับ TikTok: @${tiktokUsername}\n\n` +
      `ส่งสลิปการโอนเงินมาได้เลยครับ\n` +
      `ระบบจะตรวจสอบอัตโนมัติ\n\n` +
      ``,

    linkingSuccess: '✅ ผูกบัญชี TikTok สำเร็จแล้ว!\n\n' +
                    'สามารถส่งสลิปได้เลยครับ\n\n' +
                    '📝 หมายเหตุ: คะแนน 10 บาท = 1 แต้ม',

    linkingError: '❌ ไม่สามารถผูกบัญชี TikTok ได้\n\n' +
                  'กรุณาลองใหม่อีกครั้งหรือติดต่อแอดมินค่ะ',

    invalidUsername: '⚠️ รูปแบบ TikTok username ไม่ถูกต้อง\n\n' +
                    'กรุณาพิมพ์ @ นำหน้า username\n' +
                    'เช่น: @myusername, @user_name123\n\n' +
                    'ตัวอักษร ตัวเลข และ _ ได้เท่านั้น',
  },

  // Payment slip processing messages
  slipProcessing: {
    verifying: '⏳ กำลังตรวจสอบสลิป กรุณารอสักครู่ครับ',

    verificationSuccess: (orderData) =>
      `✅ การโอนเงินยืนยันสำเร็จ!\n\n` +
      `ยอดเงิน: ${orderData.amount.toLocaleString()} ฿\n` +
      `คะแนนที่ได้: +${orderData.pointsEarned} แต้ม\n` +
      `รหัสธุรกรรม: ${orderData.transactionId}\n\n` +
      `กดเมนูด้านล่างเพื่อแจ้งส่งของได้เลยครับ`,

    verificationFailed: (issues) =>
      `⚠️ การตรวจสอบไม่ผ่าน\n\n` +
      `${issues.join('\n')}\n\n` +
      `กรุณาตรวจสอบและส่งสลิปใหม่อีกครั้งครับ`,

    // Specific error messages
    thunderAPIError: '❌ ระบบตรวจสอบสลิปมีปัญหาชั่วคราว กรุณาลองใหม่ในภายหลังค่ะ\n\n(ขออภัยในความไม่สะดวก)',

    generalError: '❌ เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่หรือติดต่อแอดมินค่ะ',

    downloadError: '❌ ไม่สามารถดาวน์โหลดรูปภาพได้ กรุณาลองส่งใหม่อีกครั้งค่ะ'
  },

  // Follow/Unfollow messages
  followEvents: {
    welcome: '🎴 ยินดีต้อนรับสู่ Cats N Cards!\n\n' +
             'ส่งสลิปการโอนเงินเพื่อเติมคะแนนได้เลยค่ะ\n\n' +
             '💰 คะแนน 10 บาท = 1 แต้ม\n' +
             '📦 ส่งของทุกวันจันทร์/พุธ/เสาร์\n\n' +
             'กดเมนูด้านล่างเพื่อใช้งานค่ะ',

  },

  // General messages
  general: {
    commandNotRecognized: '❌ ไม่เข้าใจคำสั่ง กรุณาลองใหม่อีกครั้งค่ะ',

    featureNotAvailable: '⚠️ ฟีเจอร์นี้ยังไม่เปิดใช้งาน กรุณาติดต่อแอดมินค่ะ',

    contactAdmin: '📞 ติดต่อแอดมิน:\n' +
                  'LINE: @catsncards\n' +
                  'TikTok: @cats.n.cards.live'
  },

  // Business validation messages
  validationMessages: {
    incorrectRecipient: '- บัญชีผู้รับไม่ถูกต้อง',
    invalidBank: '- ธนาคารไม่รองรับ',
    oldTransaction: '- ธุรกรรมเกิน 24 ชั่วโมง',
    duplicateSlip: '- สลิปซ้ำ',
    invalidFormat: '- รูปแบบสลิปไม่ถูกต้อง',
    insufficientAmount: '- ยอดเงินต่ำกว่าขั้นต่ำ (50 บาท)'
  },

  // Admin panel messages
  admin: {
    orderStatusChanged: '📦 สถานะคำสั่งซื้อของคุณได้เปลี่ยนแปลงเป็น: {status}\n\n' +
                       'ตรวจสอบได้ที่: เมนู "📋 ประวัติการสั่งซื้อ"',

    orderShipped: '🚚 พัสดุของคุณได้จัดส่งแล้ว!\n\n' +
                  'หมายเลขพัสดุ: {trackingNumber}\n' +
                  'สถานะ: {status}\n\n' +
                  'ขอบคุณที่สั่งซื้อสินค้าค่ะ 🎴'
  }
};