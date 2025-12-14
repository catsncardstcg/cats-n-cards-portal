const axios = require('axios');
const FormData = require('form-data');

// Thunder API configuration
const THUNDER_API_URL = 'https://api.thunder.in.th/v1/verify';

/**
 * Enhanced Thunder API client supporting both base64 and buffer inputs
 */
class ThunderAPIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = THUNDER_API_URL;
  }

  /**
   * Verify slip using base64 image data (for LINE webhook)
   * @param {string} base64Image - Base64 encoded image
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Verification result
   */
  async verifyFromBase64(base64Image, options = {}) {
    const startTime = Date.now();

    try {
      const response = await axios.post(
        this.baseURL,
        {
          image: base64Image,
          checkDuplicate: options.checkDuplicate !== false,
          ...options
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const duration = Date.now() - startTime;
      console.log(`[Thunder API] Base64 verification completed in ${duration}ms`);

      return response.data;
    } catch (error) {
      console.error('[Thunder API] Base64 verification error:', error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Verify slip using image buffer (for file uploads)
   * @param {Buffer} imageBuffer - Image file buffer
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Verification result
   */
  async verifyFromBuffer(imageBuffer, options = {}) {
    const startTime = Date.now();

    try {
      const form = new FormData();
      form.append('file', imageBuffer, {
        filename: options.filename || 'receipt.jpg',
        contentType: options.contentType || 'image/jpeg'
      });
      form.append('checkDuplicate', options.checkDuplicate !== false);

      const response = await axios.post(
        this.baseURL,
        form,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            ...form.getHeaders()
          },
          timeout: 30000
        }
      );

      const duration = Date.now() - startTime;
      console.log(`[Thunder API] Buffer verification completed in ${duration}ms`);

      return response.data;
    } catch (error) {
      console.error('[Thunder API] Buffer verification error:', error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Parse Thunder API response to extract relevant data
   * @param {Object} response - Thunder API response
   * @returns {Object} Parsed data
   */
  parseResponse(response) {
    const data = response.data || {};

    return {
      success: response.status === 200 && data.transRef,
      transactionId: data.transRef,
      amount: data.amount?.amount || 0,
      currency: data.amount?.currency || 'THB',
      transactionDate: data.transDate,
      sender: {
        name: {
          th: data.sender?.account?.name?.th || '',
          en: data.sender?.account?.name?.en || ''
        },
        bank: {
          short: data.sender?.bank?.short || '',
          name: data.sender?.bank?.name || '',
          account: data.sender?.bank?.account || ''
        }
      },
      receiver: {
        name: {
          th: data.receiver?.account?.name?.th || '',
          en: data.receiver?.account?.name?.en || ''
        },
        bank: {
          short: data.receiver?.bank?.short || '',
          name: data.receiver?.bank?.name || '',
          account: data.receiver?.bank?.account || ''
        }
      },
      duplicate: data.duplicate || false,
      raw: response
    };
  }

  /**
   * Handle API errors consistently
   * @param {Error} error - Axios error
   * @returns {Error} Formatted error
   */
  handleError(error) {
    if (error.response) {
      // API returned error response
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          return new Error(`Bad request: ${data.message || 'Invalid input'}`);
        case 401:
          return new Error('Unauthorized: Invalid API key');
        case 422:
          return new Error(`Validation error: ${data.message || 'Unable to process image'}`);
        case 429:
          return new Error('Rate limit exceeded. Please try again later');
        case 500:
          return new Error('Thunder API internal error');
        default:
          return new Error(`API error: ${status} - ${data.message || 'Unknown error'}`);
      }
    } else if (error.request) {
      // Network error
      return new Error('Network error: Unable to reach Thunder API');
    } else {
      // Other error
      return error;
    }
  }

  /**
   * Test API connection
   * @returns {Promise<boolean>} True if API is reachable
   */
  async testConnection() {
    try {
      await axios.get(`${this.baseURL}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 5000
      });
      return true;
    } catch (error) {
      // Health endpoint might not exist, try with empty post
      try {
        await axios.post(
          this.baseURL,
          {},
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            },
            timeout: 5000
          }
        );
        return true;
      } catch (fallbackError) {
        if (fallbackError.response?.status === 400 || fallbackError.response?.status === 422) {
          // Expected error for invalid input - API is reachable
          return true;
        }
        throw error;
      }
    }
  }
}

// Create singleton instance
const thunderClient = new ThunderAPIClient(process.env.THUNDER_API_KEY);

// Export convenience functions
module.exports = {
  verifySlipFromBase64: (base64Image, options) => thunderClient.verifyFromBase64(base64Image, options),
  verifySlipFromBuffer: (imageBuffer, options) => thunderClient.verifyFromBuffer(imageBuffer, options),
  parseThunderResponse: (response) => thunderClient.parseResponse(response),
  testThunderConnection: () => thunderClient.testConnection(),
  ThunderAPIClient // For creating custom instances
};

// Legacy compatibility
module.exports.verifyWithThunderAPI = module.exports.verifySlipFromBuffer;