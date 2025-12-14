const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

const db = admin.firestore();

/**
 * Minimal LINE webhook that bypasses signature validation for testing
 */
const lineWebhookMinimal = functions
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
      console.log('=== MINIMAL LINE WEBHOOK ===');
      console.log('Headers:', Object.keys(req.headers));
      console.log('Body type:', typeof req.body);

      const signature = req.headers['x-line-signature'];
      console.log('LINE Signature present:', !!signature);

      // TEMPORARILY SKIP SIGNATURE VALIDATION FOR TESTING
      console.log('⚠️ SKIPPING SIGNATURE VALIDATION - TEMPORARY FOR DEBUGGING');

      const events = req.body?.events || [];
      console.log('Events count:', events.length);

      if (events.length === 0) {
        console.log('No events - returning 200 OK');
        return res.status(200).json({ message: 'OK' });
      }

      // Process each event
      for (const event of events) {
        console.log(`Processing event: ${event.type}`);

        if (event.type === 'follow') {
          console.log('User followed - sending welcome message');
          // Simple welcome response
          try {
            const line = require('@line/bot-sdk');
            const client = new line.Client({
              channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
            });

            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: '🎴 Welcome to Cats N Cards! Webhook is working! 🎉\n\nSend a payment slip to get started.'
            });
          } catch (error) {
            console.error('Welcome message error:', error.message);
          }
        }

        if (event.type === 'message') {
          console.log('Message received:', event.message?.type);

          if (event.message?.type === 'text') {
            console.log('Text message:', event.message.text);

            // Echo back for testing
            try {
              const line = require('@line/bot-sdk');
              const client = new line.Client({
                channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
              });

              await client.replyMessage(event.replyToken, {
                type: 'text',
                text: `✅ Received: "${event.message.text}"\n\nWebhook is working! 🎴`
              });
            } catch (error) {
              console.error('Reply error:', error.message);
            }
          }
        }
      }

      console.log('=== WEBHOOK SUCCESS ===');
      res.status(200).json({ message: 'OK' });

    } catch (error) {
      console.error('=== WEBHOOK ERROR ===');
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

module.exports = { lineWebhookMinimal };