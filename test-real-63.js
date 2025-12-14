const crypto = require('crypto');

// Create exactly 63 characters
let payload63 = '{"events":[],"destination":"U';
payload63 += 'a'.repeat(63 - payload63.length - 2); // Fill to 63 chars, minus closing braces
payload63 += '"}';

console.log('Target hash: e29c323b788754bf541964f3ae6486a9');
console.log('Generated:', payload63);
console.log('Length:', payload63.length);
console.log('MD5:', crypto.createHash('md5').update(payload63).digest('hex'));

// Also test some common LINE formats
const commonFormats = [
  '{"destination":"U1234567890abcdef1234567890abcdef"}',
  '{"events":[],"destination":"U1234567890abcdef1234567890abcdef"}',
  '{"events":null,"destination":"U1234567890abcdef1234567890abcdef"}',
];

commonFormats.forEach((format, i) => {
  console.log(`\nFormat ${i+1}:`, format);
  console.log('Length:', format.length);
  console.log('MD5:', crypto.createHash('md5').update(format).digest('hex'));
});