const crypto = require('crypto');

const testPayloads = [
  '{"events":[]}',
  '{"events":null}',
  '{"destination":"Uxxxxxxxxxxxxxx"}',
  '{}'
];

testPayloads.forEach(payload => {
  console.log('Payload:', payload);
  console.log('Length:', payload.length);
  console.log('MD5:', crypto.createHash('md5').update(payload).digest('hex'));
  console.log('---');
});