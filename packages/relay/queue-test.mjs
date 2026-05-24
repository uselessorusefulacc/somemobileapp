import { WebSocket } from 'ws';
const SESSION_ID = "550e8400-e29b-41d4-a716-44665544ccdd";
const URL = "ws://localhost:8080";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  // Step 1: connect daemon first, send 5 messages before phone joins
  const daemon = new WebSocket(`${URL}?session=${SESSION_ID}&role=daemon`);
  await new Promise(r => daemon.on('open', r));
  console.log('[DAEMON] connected, sending 5 msgs before phone...');
  for (let i = 0; i < 5; i++) {
    daemon.send(JSON.stringify({ type: 'tokens', payload: { model: 'gpt-4o', inputTokens: 1000+i*100, outputTokens: 500, costUsd: 0.005 }, timestamp: Date.now() }));
  }
  
  await sleep(500);
  
  // Step 2: phone connects - should receive queued messages
  let queuedCount = 0;
  const phone = new WebSocket(`${URL}?session=${SESSION_ID}&role=phone`);
  await new Promise(r => phone.on('open', r));
  console.log('[PHONE] connected');
  phone.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'tokens') { queuedCount++; console.log('[PHONE] got queued token msg'); }
  });
  
  await sleep(1000);
  console.log(`\n=== Queue flush: got ${queuedCount}/5 queued msgs`);
  console.log(queuedCount === 5 ? '✅ QUEUE FLUSH: WORKS (5/5)' : queuedCount > 0 ? `⚠️ PARTIAL: ${queuedCount}/5` : '❌ QUEUE FLUSH: 0 msgs received');
  phone.close(); daemon.close();
}

runTest().catch(e => { console.error(e); process.exit(1); });
