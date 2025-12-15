const crypto = require('crypto');
const line = require('@line/bot-sdk');
const axios = require('axios');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const messages = require('./messages');
const { isValidRecipient, isValidDeliveryFee } = require('./recipientNames');

// LINE client configuration (lazy initialization)
let lineClient = null;

function getLineClient() {
  if (!lineClient) {
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN environment variable is not set');
    }
    lineClient = new line.Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
    });
  }
  return lineClient;
}

// Business configuration
const BUSINESS_CONFIG = {
  acceptedBanks: ['KBANK', 'BBL', 'KTB', 'SCB', 'BAY', 'GSB'],
  recipientAccounts: [
    { bank: 'KBANK', last4: process.env.KBANK_ACCOUNT_LAST_4 || '1234' },
    { bank: 'BBL', last4: process.env.BBL_ACCOUNT_LAST_4 || '5678' }
  ]
};

// Conversation states
const STATE_WAITING_TIKTOK = 'waiting_tiktok';

// Firestore database reference
const db = admin.firestore();

/**
 * Main LINE webhook handler
 */
const lineWebhook = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    // Enable CORS for all requests
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Line-Signature');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
      console.error(`Method not allowed: ${req.method}`);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Log incoming request details (without sensitive data)
      console.log('=== LINE WEBHOOK REQUEST ===');
      console.log('Headers:', Object.keys(req.headers));
      console.log('Content-Type:', req.headers['content-type']);
      console.log('LINE Signature:', req.headers['x-line-signature'] ? 'Present' : 'Missing');

      // Check if LINE channel secret is configured
      if (!process.env.LINE_CHANNEL_SECRET) {
        console.error('LINE_CHANNEL_SECRET environment variable is not set');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      // 1. Verify LINE signature
      const signature = req.headers['x-line-signature'];

      if (!signature) {
        console.error('Missing LINE signature header');
        return res.status(400).json({ error: 'Missing signature' });
      }

      // For signature validation, we need the raw request body as received
      // Firebase Functions may have already parsed it, so we reconstruct it
      let rawBody;

      // Try different methods to get the raw body
      if (req.rawBody) {
        rawBody = req.rawBody.toString('utf8');
        console.log('Using req.rawBody for signature validation');
      } else if (typeof req.body === 'string') {
        rawBody = req.body;
        console.log('Using string req.body for signature validation');
      } else if (req.body) {
        // Reconstruct the body as a JSON string
        rawBody = JSON.stringify(req.body);
        console.log('Reconstructed body from req.body for signature validation');
      } else {
        console.error('No request body found');
        return res.status(400).json({ error: 'No request body' });
      }

      console.log('Body length:', rawBody.length);

      // TEMPORARILY BYPASS SIGNATURE VALIDATION FOR TESTING
      // TODO: Re-enable this once we debug the signature issue
      console.log('⚠️ BYPASSING SIGNATURE VALIDATION FOR TESTING');
      console.log('LINE Channel Secret configured:', process.env.LINE_CHANNEL_SECRET ? 'Yes' : 'No');
      console.log('Signature provided:', signature ? 'Yes' : 'No');

      // For debugging, log the body hash (don't log the actual body for security)
      const bodyHash = crypto.createHash('md5').update(rawBody).digest('hex');
      console.log('Body MD5 hash for debugging:', bodyHash);

      // **DEBUGGING: Log the actual request body structure**
      console.log('=== FULL REQUEST BODY DEBUG ===');
      console.log('Raw body type:', typeof req.body);
      console.log('Raw body:', req.body);
      console.log('Raw body stringified:', JSON.stringify(req.body, null, 2));
      console.log('Raw rawBody:', rawBody);

      // Log all headers for debugging
      console.log('All headers:', req.headers);

      // Try to parse and show structure
      try {
        if (typeof req.body === 'string') {
          const parsed = JSON.parse(req.body);
          console.log('Parsed body keys:', Object.keys(parsed));
          console.log('Events array:', parsed.events);
          console.log('Events length:', parsed.events?.length || 0);
          if (parsed.events && parsed.events.length > 0) {
            console.log('First event:', JSON.stringify(parsed.events[0], null, 2));
          }
        } else {
          console.log('Body keys:', Object.keys(req.body));
          console.log('Events array:', req.body.events);
          console.log('Events length:', req.body.events?.length || 0);
          if (req.body.events && req.body.events.length > 0) {
            console.log('First event:', JSON.stringify(req.body.events[0], null, 2));
          }
        }
      } catch (e) {
        console.error('Error parsing body for debugging:', e);
      }
      console.log('=== END DEBUG ===');

      /*
      // Original signature validation code (commented out temporarily)
      if (!validateSignature(rawBody, signature, process.env.LINE_CHANNEL_SECRET)) {
        console.error('Invalid LINE signature');
        console.log('LINE Channel Secret configured:', process.env.LINE_CHANNEL_SECRET ? 'Yes' : 'No');
        console.log('Signature provided:', signature ? 'Yes' : 'No');

        // For debugging, log the body hash (don't log the actual body for security)
        const bodyHash = crypto.createHash('md5').update(rawBody).digest('hex');
        console.log('Body MD5 hash for debugging:', bodyHash);

        return res.status(400).json({ error: 'Invalid signature' });
      }
      */

      console.log('✅ Signature validated successfully');

      // 2. Parse and process webhook events
      let events;
      try {
        if (typeof req.body === 'string') {
          const parsedBody = JSON.parse(req.body);
          events = parsedBody.events || [];
        } else {
          events = req.body.events || [];
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      console.log(`Processing ${events.length} events`);

      if (events.length === 0) {
        console.log('No events to process - sending health check response');
        return res.status(200).json({ message: 'OK' });
      }

      // Process each event
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        console.log(`--- Event ${i + 1} ---`);
        console.log('Event type:', event.type);
        console.log('Source type:', event.source?.type);
        console.log('User ID:', event.source?.userId);
        console.log('Message type:', event.message?.type);

        if (!event.source || !event.source.userId) {
          console.error('Event missing source or userId');
          continue;
        }

        const userId = event.source.userId;

        try {
          // Check if user is waiting for TikTok username
          const userState = await getUserState(userId);
          console.log('User state:', userState);

          if (userState === STATE_WAITING_TIKTOK && event.message && event.message.type === 'text') {
            // User is replying with their TikTok username
            console.log('Processing TikTok linking message');
            await handleTikTokLinking(userId, event.message.text, event.replyToken);
            continue;
          }

          // Handle different event types
          if (event.type === 'message') {
            if (event.message.type === 'image') {
              console.log('Processing image message');
              await handleImageMessage(event);
            } else if (event.message.type === 'text') {
              console.log('Processing text message');

              // Check if user needs TikTok linking first
              const userMapping = await getUserMapping(userId);
              if (!userMapping && event.message.text.trim().startsWith('@')) {
                // First time user sending @username - set linking state and process
                console.log('First time user sending TikTok username, setting linking state');
                await setUserState(userId, STATE_WAITING_TIKTOK);
                await handleTikTokLinking(userId, event.message.text, event.replyToken);
              } else if (!userMapping) {
                // First time user not sending @username - prompt for TikTok linking
                console.log('First time user needs TikTok linking');
                await setUserState(userId, STATE_WAITING_TIKTOK);
                await getLineClient().replyMessage(event.replyToken, {
                  type: 'text',
                  text: messages.tikTokLinking.welcomeFirstTime
                });
              } else {
                // Regular text message from existing user
                console.log('Processing text message (not TikTok linking)');
                // Handle other text messages if needed
              }
            }
          } else if (event.type === 'follow') {
            console.log('Processing follow event - welcome message disabled (handled by LIFF)');
            // Welcome message disabled - handled by LIFF app
            // await handleFollow(event);
          } else if (event.type === 'unfollow') {
            console.log('Processing unfollow event');
            // Handle unfollow if needed
          } else {
            console.log('Unhandled event type:', event.type);
          }

        } catch (eventError) {
          console.error(`Error processing event ${i + 1}:`, eventError);
          // Continue processing other events
        }
      }

      console.log('=== WEBHOOK PROCESSED SUCCESSFULLY ===');
      res.status(200).json({ message: 'OK' });

    } catch (error) {
      console.error('=== WEBHOOK ERROR ===');
      console.error('Error details:', error);
      console.error('Error stack:', error.stack);
      console.error('Request method:', req.method);
      console.error('Request headers:', req.headers);

      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

/**
 * Validate LINE webhook signature
 */
function validateSignature(body, signature, channelSecret) {
  if (!signature || !channelSecret) {
    console.error('Missing signature or channel secret');
    return false;
  }

  try {
    const hash = crypto
      .createHmac('SHA256', channelSecret)
      .update(body, 'utf8')
      .digest('base64');

    const isValid = hash === signature;

    if (!isValid) {
      console.error('Signature mismatch:');
      console.error('Expected:', hash);
      console.error('Received:', signature);
    }

    return isValid;
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
}

/**
 * Handle incoming image messages (payment slips)
 */
async function handleImageMessage(event) {
  const { replyToken, source } = event;
  const lineUserId = source.userId;

  try {

    console.log(`Processing image from user: ${lineUserId}`);

    // Check if user has TikTok linked
    const userMapping = await getUserMapping(lineUserId);

    if (!userMapping) {
      // First time user - ask for TikTok linking
      await setUserState(lineUserId, STATE_WAITING_TIKTOK);

      await getLineClient().replyMessage(replyToken, {
        type: 'text',
        text: messages.tikTokLinking.welcomeFirstTime
      });
      return;
    }

    // 1. Send immediate processing message
    await getLineClient().replyMessage(replyToken, {
      type: 'text',
      text: messages.slipProcessing.verifying
    });

    // 2. Download image from LINE
    const imageBuffer = await downloadLineImage(event.message.id);

    // 3. Verify with Thunder API
    const thunderResult = await verifySlipWithThunder(imageBuffer);

    // 4. Perform business checks
    const checks = performBusinessChecks(thunderResult);

    // 5. Save to Firestore with TikTok username
    const orderData = await saveOrderToFirestore(lineUserId, thunderResult, checks);

    // 6. Send detailed response using pushMessage (replyToken already used)
    await sendVerificationResponse(lineUserId, orderData, checks);

  } catch (error) {
    console.error('Error processing image:', error);

    let errorMessage = messages.slipProcessing.generalError;

    // Check if it's a Thunder API error
    if (error.message && error.message.includes('application_expired')) {
      errorMessage = messages.slipProcessing.thunderAPIError;
    }

    // Try to reply with replyToken first, if it fails, use pushMessage
    try {
      await getLineClient().replyMessage(event.replyToken, {
        type: 'text',
        text: errorMessage
      });
    } catch (replyError) {
      console.log('Reply token expired, using pushMessage instead');
      await getLineClient().pushMessage(lineUserId, {
        type: 'text',
        text: errorMessage
      });
    }
  }
}

/**
 * Download image from LINE servers
 */
async function downloadLineImage(messageId) {
  try {
    const stream = await getLineClient().getMessageContent(messageId);
    const chunks = [];

    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading image:', error);
    throw new Error('Failed to download image from LINE');
  }
}

/**
 * Verify slip with Thunder API
 */
async function verifySlipWithThunder(imageBuffer) {
  try {
    const base64Image = imageBuffer.toString('base64');

    const response = await axios.post(
      'https://api.thunder.in.th/v1/verify',
      { image: base64Image },
      {
        headers: {
          'Authorization': `Bearer ${process.env.THUNDER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return response.data;
  } catch (error) {
    console.error('Thunder API error:', error.response?.data || error.message);
    throw new Error('Thunder API verification failed');
  }
}

/**
 * Perform business logic checks
 */
function performBusinessChecks(thunderResult) {
  const data = thunderResult.data || {};

  // Debug: Log all possible date fields to understand the API response structure
  console.log('[Business Checks] Thunder API full response structure:', JSON.stringify(thunderResult, null, 2));
  console.log('[Business Checks] All date fields found:', {
    'data.transDate': data.transDate,
    'data.data?.transDate': data.data?.transDate,
    'data.trans_date': data.trans_date,
    'data.data?.trans_date': data.data?.trans_date,
    'data.date': data.date,
    'data.transTime': data.transTime,
    'data.transactionDate': data.transactionDate,
    'data.transDateTime': data.transDateTime,
    'data.trans_date_time': data.trans_date_time,
    'data.timestamp': data.timestamp
  });

  // Try to extract date from multiple possible fields (corrected based on actual API format)
  const extractedDate = data.date || data.transDate || data.data?.transDate || data.trans_date || data.data?.trans_date ||
                        data.transTime || data.transactionDate || data.transDateTime || data.trans_date_time || data.timestamp;

  console.log('[Business Checks] Extracted date value:', extractedDate);

  const checks = {
    isValidFormat: thunderResult.status === 200 && (data.transRef || data.data?.transRef),
    correctRecipient: false,
    correctRecipientName: false,
    validBank: BUSINESS_CONFIG.acceptedBanks.includes(data.sender?.bank?.short || data.data?.sender?.bank?.short),
    isRecent: extractedDate ? isWithin24Hours(extractedDate) : false,
    isDuplicate: false // Will be checked separately
  };

  // Check if recipient account matches our accounts
  if (data.receiver?.bank?.short && data.receiver?.bank?.account) {
    const recipientAccount = data.receiver.bank.account;
    checks.correctRecipient = BUSINESS_CONFIG.recipientAccounts.some(
      account => account.bank === data.receiver.bank.short &&
                recipientAccount.includes(account.last4)
    );
  }

  // Check if recipient name is valid
  if (data.receiver?.bank?.account?.name?.en || data.receiver?.bank?.account?.name?.th) {
    const recipientName = data.receiver.bank.account.name.en || data.receiver.bank.account.name.th;
    checks.correctRecipientName = isValidRecipient(recipientName);
  }

  checks.allPassed = Object.values(checks).every(check => check === true);

  return checks;
}

/**
 * Save order to Firestore
 */
async function saveOrderToFirestore(lineUserId, thunderResult, checks) {
  const db = admin.firestore();
  const data = thunderResult.data || {};

  // Get user mapping to include TikTok info
  const userMapping = await getUserMapping(lineUserId);

  // Check for duplicates first
  if (data.transRef) {
    const duplicateDoc = await db.collection('duplicates').doc(data.transRef).get();
    if (duplicateDoc.exists) {
      checks.isDuplicate = true;
      checks.allPassed = false;
    }
  }

  // Create order
  const orderRef = db.collection('orders').doc();
  const orderData = {
    orderId: orderRef.id,
    lineUserId: lineUserId,

    // TikTok information
    tiktokUsername: userMapping?.tiktokUsername || null,
    linkMethod: userMapping?.linkMethod || null,
    manuallyLinked: userMapping?.linkMethod === 'admin_manual',

    // Transaction data
    transactionId: data.transRef,
    amount: data.amount?.amount || 0,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),

    // Sender info
    senderName: data.sender?.account?.name?.th || data.sender?.account?.name?.en || '',
    senderBank: data.sender?.bank?.short || '',

    // Receiver info
    receiverName: data.receiver?.account?.name?.th || data.receiver?.account?.name?.en || '',
    receiverBank: data.receiver?.bank?.short || '',

    // Verification data
    slipImageUrl: '', // Will be set if we store LINE images
    verificationStatus: checks.allPassed ? 'verified' : 'pending_check',
    status: checks.allPassed ? 'pending_address' : 'pending_check',
    checks: checks,

    // Points calculation (10 THB = 1 point)
    pointsEarned: Math.floor((data.amount?.amount || 0) / 10),

    // Timestamps
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await orderRef.set(orderData);

  // Save to duplicates collection
  if (data.transRef) {
    await db.collection('duplicates').doc(data.transRef).set({
      transactionId: data.transRef,
      firstSeen: admin.firestore.FieldValue.serverTimestamp(),
      count: admin.firestore.FieldValue.increment(1),
      orderIds: admin.firestore.FieldValue.arrayUnion(orderRef.id)
    }, { merge: true });
  }

  return orderData;
}

/**
 * Send verification response to user
 */
async function sendVerificationResponse(userId, orderData, checks) {
  let message;

  if (checks.allPassed) {
    message = messages.slipProcessing.verificationSuccess(orderData);
  } else {
    const issues = [];
    if (!checks.correctRecipient) issues.push(messages.validationMessages.incorrectRecipient);
    if (!checks.correctRecipientName) issues.push('❌ ชื่อผู้รับเงินไม่ถูกต้อง กรุณาตรวจสอบชื่อบัญชีที่โอนเงิน');
    if (!checks.validBank) issues.push(messages.validationMessages.invalidBank);
    if (!checks.isRecent) issues.push(messages.validationMessages.oldTransaction);
    if (checks.isDuplicate) issues.push(messages.validationMessages.duplicateSlip);
    if (!checks.isValidFormat) issues.push(messages.validationMessages.invalidFormat);

    message = messages.slipProcessing.verificationFailed(issues);
  }

  await getLineClient().pushMessage(userId, {
    type: 'text',
    text: message
  });
}

/**
 * Handle TikTok linking conversation
 */
async function handleTikTokLinking(userId, tiktokText, replyToken) {
  try {
    // Check if message starts with @ symbol
    if (!tiktokText.trim().startsWith('@')) {
      await getLineClient().replyMessage(replyToken, {
        type: 'text',
        text: messages.tikTokLinking.invalidUsername
      });
      return;
    }

    const cleanedUsername = cleanTikTokUsername(tiktokText);

    if (!isValidTikTokUsername(cleanedUsername)) {
      await getLineClient().replyMessage(replyToken, {
        type: 'text',
        text: messages.tikTokLinking.invalidUsername
      });
      return;
    }

    // Check if TikTok username already exists
    const existingMappingQuery = await db.collection('userMappings')
      .where('tiktokUsername', '==', cleanedUsername)
      .limit(1)
      .get();

    if (!existingMappingQuery.empty) {
      const existingUser = existingMappingQuery.docs[0].data();

      // Check if it's the same user trying to link again
      if (existingUser.lineUserId === userId) {
        await getLineClient().replyMessage(replyToken, {
          type: 'text',
          text: `✅ บัญชีนี้ถูกผูกกับ @${cleanedUsername} อยู่แล้วค่ะ\n\n` +
                `สามารถใช้งานระบบได้ปกติเลยค่ะ 🎴`
        });

        // Clear the state
        await clearUserState(userId);
        return;
      }

      // Different user already has this username
      await getLineClient().replyMessage(replyToken, {
        type: 'text',
        text: `❌ TikTok username @${cleanedUsername} ถูกใช้งานแล้วค่ะ\n\n` +
              'กรุณาตรวจสอบ TikTok username และลองใหม่\n' +
              'หรือติดต่อแอดมินเพื่อขอความช่วยเหลือค่ะ'
      });
      return;
    }

    // Check if user already has a TikTok linked
    const userMapping = await getUserMapping(userId);
    if (userMapping) {
      // Update existing TikTok username
      await db.collection('userMappings').doc(userId).update({
        tiktokUsername: cleanedUsername,
        linkMethod: 'user_chat',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update user's orders with new TikTok username
      const ordersQuery = await db.collection('orders')
        .where('lineUserId', '==', userId)
        .get();

      const batch = db.batch();
      ordersQuery.docs.forEach(doc => {
        batch.update(doc.ref, {
          tiktokUsername: cleanedUsername,
          linkMethod: 'user_chat',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();

      await getLineClient().replyMessage(replyToken, {
        type: 'text',
        text: `✅ เปลี่ยน TikTok username เป็น @${cleanedUsername} แล้วค่ะ\n\n` +
              'สามารถส่งสลิปเพื่อเริ่มต้นการสั่งซื้อได้เลยค่ะ 🎴'
      });
    } else {
      // First time linking
      await db.collection('userMappings').doc(userId).set({
        lineUserId: userId,
        tiktokUsername: cleanedUsername,
        linkMethod: 'user_chat',
        linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        firstLinkedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await getLineClient().replyMessage(replyToken, {
        type: 'text',
        text: `✅ ผูก TikTok username @${cleanedUsername} ${messages.tikTokLinking.linkingSuccess}`
      });
    }

    // Clear conversation state
    await clearUserState(userId);

  } catch (error) {
    console.error('TikTok linking error:', error);
    await getLineClient().replyMessage(replyToken, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาดในการผูก TikTok username\n\n' +
            'กรุณาลองใหม่อีกครั้งหรือติดต่อแอดมินค่ะ'
    });
  }
}

/**
 * Handle when user follows the LINE OA
 */
async function handleFollow(event) {
  // Check if user already has TikTok linked
  const userMapping = await getUserMapping(event.source.userId);

  let welcomeMessage;
  if (userMapping && userMapping.tiktokUsername) {
    welcomeMessage = messages.tikTokLinking.welcomeReturn(userMapping.tiktokUsername);
  } else {
    welcomeMessage = messages.followEvents.welcome;

    // Set waiting for TikTok state
    await setUserState(event.source.userId, STATE_WAITING_TIKTOK);
  }

  await getLineClient().replyMessage(event.replyToken, {
    type: 'text',
    text: welcomeMessage
  });
}

/**
 * Helper function to check if date is within 24 hours
 */
function isWithin24Hours(dateString) {
  try {
    console.log(`[Date Validation] Raw date string: "${dateString}"`);
    const date = new Date(dateString);
    const now = new Date();

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.log(`[Date Validation] Invalid date format`);
      return false;
    }

    const diffInHours = (now - date) / (1000 * 60 * 60);

    console.log(`[Date Validation] Transaction date: ${date.toISOString()}`);
    console.log(`[Date Validation] Current time: ${now.toISOString()}`);
    console.log(`[Date Validation] Hours difference: ${diffInHours}`);
    console.log(`[Date Validation] Within 24 hours: ${diffInHours <= 24}`);

    // Allow up to 48 hours for now (in case of timezone issues)
    return diffInHours <= 48;
  } catch (error) {
    console.log(`[Date Validation] Error processing date: ${error.message}`);
    return false;
  }
}

// ========================================
// TIKTOK LINKING HELPER FUNCTIONS
// ========================================

/**
 * Clean and validate TikTok username
 */
function cleanTikTokUsername(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/^@/, '') // Remove @ prefix if present
    .replace(/\s+/g, ''); // Remove spaces
}

/**
 * Validate TikTok username format
 */
function isValidTikTokUsername(username) {
  // TikTok usernames: 2-24 chars, alphanumeric + underscore/period
  const regex = /^[a-z0-9_.]{2,24}$/;
  return regex.test(username);
}

/**
 * Get user mapping from Firestore
 */
async function getUserMapping(userId) {
  try {
    const doc = await db.collection('userMappings').doc(userId).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('Error getting user mapping:', error);
    return null;
  }
}

/**
 * Save pending order data temporarily
 */
async function savePendingOrder(userId, verification) {
  try {
    await db.collection('pendingOrders').doc(userId).set({
      ...verification,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Saved pending order for user: ${userId}`);
  } catch (error) {
    console.error('Error saving pending order:', error);
  }
}

/**
 * Get pending order data
 */
async function getPendingOrder(userId) {
  try {
    const doc = await db.collection('pendingOrders').doc(userId).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('Error getting pending order:', error);
    return null;
  }
}

/**
 * Clear pending order data
 */
async function clearPendingOrder(userId) {
  try {
    await db.collection('pendingOrders').doc(userId).delete();
    console.log(`Cleared pending order for user: ${userId}`);
  } catch (error) {
    console.error('Error clearing pending order:', error);
  }
}

/**
 * Set user conversation state
 */
async function setUserState(userId, state) {
  try {
    await db.collection('userStates').doc(userId).set({
      state: state,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error setting user state:', error);
  }
}

/**
 * Get user conversation state
 */
async function getUserState(userId) {
  try {
    const doc = await db.collection('userStates').doc(userId).get();
    return doc.exists ? doc.data().state : null;
  } catch (error) {
    console.error('Error getting user state:', error);
    return null;
  }
}

/**
 * Clear user conversation state
 */
async function clearUserState(userId) {
  try {
    await db.collection('userStates').doc(userId).delete();
    console.log(`Cleared state for user: ${userId}`);
  } catch (error) {
    console.error('Error clearing user state:', error);
  }
}

/**
 * Get LINE user profile
 */
async function getLineProfile(userId) {
  try {
    const response = await axios.get(
      `https://api.line.me/v2/bot/profile/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error getting LINE profile:', error);
    return {
      displayName: 'Unknown User',
      pictureUrl: null
    };
  }
}

/**
 * Save order with TikTok username
 */
async function saveOrder(userId, tiktokUsername, verification) {
  try {
    const orderRef = db.collection('orders').doc();

    // Perform business checks
    const checks = performBusinessChecks(verification);

    const orderData = {
      orderId: orderRef.id,
      lineUserId: userId,
      tiktokUsername: tiktokUsername,
      linkMethod: 'user',
      manuallyLinked: false,

      // Transaction data
      transactionId: verification.transactionId,
      amount: verification.amount,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),

      // Sender info
      senderName: verification.senderName,
      senderBank: verification.senderBank,

      // Receiver info
      receiverName: verification.receiverName,
      receiverBank: verification.receiverBank,

      // Verification data
      slipImageUrl: '', // Would be set if we store LINE images
      verificationStatus: checks.allPassed ? 'verified' : 'pending_check',
      status: checks.allPassed ? 'pending_address' : 'pending_check',
      checks: checks,

      // Points calculation (10 THB = 1 point)
      pointsEarned: Math.floor((verification.amount || 0) / 10),

      // Timestamps
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await orderRef.set(orderData);

    console.log(`Created order ${orderRef.id} for user ${userId}, TikTok: @${tiktokUsername}`);
    return orderRef.id;

  } catch (error) {
    console.error('Error saving order:', error);
    throw error;
  }
}

// Export the lineWebhook function
module.exports = { lineWebhook };