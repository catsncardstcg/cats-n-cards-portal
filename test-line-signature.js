const crypto = require('crypto');

// Test LINE signature validation
const CHANNEL_SECRET = '20b29c4e0671e2cafc000793c7822976';
const testBody = '{"events":[{"type":"message","message":{"type":"text","text":"test"},"source":{"userId":"testUser","type":"user"},"replyToken":"testToken"}]}';

function generateSignature(body, channelSecret) {
  return crypto
    .createHmac('SHA256', channelSecret)
    .update(body, 'utf8')
    .digest('base64');
}

const signature = generateSignature(testBody, CHANNEL_SECRET);
console.log('Test Body:', testBody);
console.log('Generated Signature:', signature);
console.log('Channel Secret:', CHANNEL_SECRET);

// Verify signature
function validateSignature(body, signature, channelSecret) {
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body, 'utf8')
    .digest('base64');

  return hash === signature;
}

const isValid = validateSignature(testBody, signature, CHANNEL_SECRET);
console.log('Signature is valid:', isValid);

// Test curl command
console.log('\nTest with curl:');
console.log(`curl -X POST https://asia-southeast1-cats-n-cards-tcg.cloudfunctions.net/lineWebhook \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -H "X-Line-Signature: ${signature}" \\`);
console.log(`  -d '${testBody}'`);