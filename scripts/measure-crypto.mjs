import { webcrypto } from 'crypto';
const { subtle } = webcrypto;

async function benchmarkCrypto(sizeMB) {
  const bytes = new Uint8Array(sizeMB * 1024 * 1024);
  // generate a random key
  const key = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const iv = webcrypto.getRandomValues(new Uint8Array(12));

  const start = performance.now();
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    bytes
  );
  const encTime = performance.now() - start;

  const startDec = performance.now();
  await subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  const decTime = performance.now() - startDec;

  return {
    sizeMB,
    encryptMs: encTime.toFixed(1),
    decryptMs: decTime.toFixed(1),
    throughputMBps: ((sizeMB / (encTime / 1000))).toFixed(1)
  };
}

async function run() {
  console.log('Testing AES-GCM-256 Client-Side Encryption Speeds...');
  const results = [];
  results.push(await benchmarkCrypto(1));
  results.push(await benchmarkCrypto(10));
  results.push(await benchmarkCrypto(50));
  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
