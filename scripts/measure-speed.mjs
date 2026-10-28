import http from 'http';
import { performance } from 'perf_hooks';

const routes = [
  '/',
  '/drop',
  '/text',
  '/chat',
  '/manage',
  '/manifest.json',
  '/icons/icon-192.png'
];

async function measureRoute(urlPath) {
  const timings = [];
  let size = 0;
  let status = 0;

  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => {
      const start = performance.now();
      let ttfb = 0;

      const req = http.get(`http://localhost:3000${urlPath}`, (res) => {
        ttfb = performance.now() - start;
        status = res.statusCode;
        let dataLen = 0;
        res.on('data', (chunk) => {
          dataLen += chunk.length;
        });
        res.on('end', () => {
          const total = performance.now() - start;
          size = dataLen;
          timings.push({ ttfb, total });
          resolve();
        });
      });

      req.on('error', () => {
        resolve();
      });
    });
  }

  // Drop warm-up run (first run) and average the rest
  const samples = timings.slice(1);
  const avgTTFB = samples.reduce((acc, s) => acc + s.ttfb, 0) / samples.length;
  const avgTotal = samples.reduce((acc, s) => acc + s.total, 0) / samples.length;

  return {
    path: urlPath,
    status,
    sizeKB: (size / 1024).toFixed(2),
    avgTTFB: avgTTFB.toFixed(1),
    avgTotal: avgTotal.toFixed(1)
  };
}

async function run() {
  console.log('Testing route response speeds on localhost:3000...');
  const results = [];
  for (const r of routes) {
    results.push(await measureRoute(r));
  }
  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
