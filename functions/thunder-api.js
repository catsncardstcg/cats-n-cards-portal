const axios = require('axios');
const FormData = require('form-data');

// Thunder API configuration
const THUNDER_API_URL = 'https://api.thunder.in.th/v1/verify';
const THUNDER_ACCESS_TOKEN = '5232d711-25e6-4e1e-bfa7-eb53a38ffbae';

/**
 * Verify bank slip image with Thunder API
 * @param {Buffer} imageBuffer - The receipt image as buffer
 * @returns {Promise<Object>} Thunder API response
 */
async function verifyWithThunderAPI(imageBuffer) {
  console.log('[Thunder API] Starting verification...');
  console.log('[Thunder API] Image buffer size:', imageBuffer.length, 'bytes');

  const form = new FormData();
  form.append('file', imageBuffer, {
    filename: 'receipt.jpg',
    contentType: 'image/jpeg'
  });
  form.append('checkDuplicate', 'true'); // Enable duplicate checking

  const startTime = Date.now();

  try {
    const response = await axios.post(
      THUNDER_API_URL,
      form,
      {
        headers: {
          'Authorization': `Bearer ${THUNDER_ACCESS_TOKEN}`,
          ...form.getHeaders()
        },
        timeout: 30000 // 30 seconds timeout
      }
    );

    const duration = Date.now() - startTime;
    console.log('[Thunder API] ✅ Verification completed in', duration, 'ms');
    console.log('[Thunder API] Response status:', response.status);

    return response.data;
  } catch (error) {
    console.error('[Thunder API] ❌ Error during verification:', error.message);

    if (error.response) {
      console.error('[Thunder API] Status:', error.response.status);
      console.error('[Thunder API] Data:', error.response.data);
    }

    throw error;
  }
}

/**
 * Test connection to Thunder API
 * @returns {Promise<boolean>} True if connection works
 */
async function testThunderConnection() {
  console.log('[Thunder API] Testing connection...');

  try {
    const form = new FormData();
    // Send empty form to test connection (will fail but tells us if API is reachable)
    await axios.post(
      THUNDER_API_URL,
      form,
      {
        headers: {
          'Authorization': `Bearer ${THUNDER_ACCESS_TOKEN}`
        },
        timeout: 5000
      }
    );
    return true;
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 422) {
      // These are expected errors for missing file - means API is reachable
      console.log('[Thunder API] ✅ Connection test successful (API is reachable)');
      return true;
    }
    throw error;
  }
}

module.exports = {
  verifyWithThunderAPI,
  testThunderConnection
};