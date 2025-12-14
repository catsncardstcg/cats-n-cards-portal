const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

// LINE client configuration (lazy initialization)
let lineClient = null;

function getLineClient() {
  if (!lineClient) {
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN environment variable is not set');
    }
    lineClient = new (require('@line/bot-sdk')).Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
    });
  }
  return lineClient;
}

// Conversation states
const STATE_WAITING_TIKTOK = 'waiting_tiktok';
const db = admin.firestore();

/**
 * Simple LINE webhook handler for testing
 */
const lineWebhookSimple = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Line-Signature');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      console.log('=== SIMPLE LINE WEBHOOK ===');
      console.log('Headers:', Object.keys(req.headers));
      console.log('Has LINE Signature:', !!req.headers['x-line-signature']);

      // TEMPORARILY BYPASS SIGNATURE VALIDATION FOR TESTING
      console.log('⚠️ BYPASSING SIGNATURE VALIDATION FOR TESTING');

      const signature = req.headers['x-line-signature'];
      const body = req.body || {};

      console.log('Request body type:', typeof req.body);
      console.log('Events count:', body.events?.length || 0);

      const events = body.events || [];

      if (events.length === 0) {
        console.log('No events - returning OK');
        return res.status(200).json({ message: 'OK - No events' });
      }

      // Process events (simplified)
      for (const event of events) {
        console.log(`Event: ${event.type} from ${event.source?.userId}`);

        if (event.type === 'message' && event.message?.type === 'text') {
          console.log('Text message:', event.message.text);

          // Simple reply for testing
          try {
            await getLineClient().replyMessage(event.replyToken, {
              type: 'text',
              text: `✅ Message received: "${event.message.text}"`
            });
          } catch (replyError) {
            console.error('Reply error:', replyError.message);
          }
        }

        if (event.type === 'follow') {
          console.log('User followed');
          try {
            await getLineClient().replyMessage(event.replyToken, {
              type: 'text',
              text: '🎴 Welcome to Cats N Cards! Webhook is working!'
            });
          } catch (replyError) {
            console.error('Follow reply error:', replyError.message);
          }
        }
      }

      console.log('=== WEBHOOK PROCESSED ===');
      res.status(200).json({ message: 'OK' });

    } catch (error) {
      console.error('=== WEBHOOK ERROR ===');
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

module.exports = { lineWebhookSimple };