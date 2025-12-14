const crypto = require('crypto');

// Try to find a 63-character payload with the matching hash
const destination = "U4d7a3b2c1e9f8a7d6b5c4d3e2f1a0b9"; // 32 chars
const payload = `{"destination":"${destination}"}`; // 33 + 32 = 65 chars, too long

// Try a different approach - create exactly 63 characters
const payload63 = `{"destination":"U4d7a3b2c1e9f8a7d6b5c4d3e2f"}`; // 47 chars
console.log('Payload63:', payload63);
console.log('Length63:', payload63.length);
console.log('MD5_63:', crypto.createHash('md5').update(payload63).digest('hex'));

// Try empty events with destination
const eventsDest = `{"destination":"U123","events":[]}`;
console.log('\nEvents+Dest:', eventsDest);
console.log('Length ED:', eventsDest.length);
console.log('MD5 ED:', crypto.createHash('md5').update(eventsDest).digest('hex'));

// Try LINE webhook validation format
const validation = `{"events":[],"destination":"U4d7a3b2c1e9f8a7d6b5c4d3e2f1a"}`;
console.log('\nValidation:', validation);
console.log('Length V:', validation.length);
console.log('MD5 V:', crypto.createHash('md5').update(validation).digest('hex'));