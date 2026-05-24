import { WebSocket } from 'ws';
const SESSION_ID = "550e8400-e29b-41d4-a716-44665544aabb";
const URL = "ws://localhost:8080";

let received = { phone: [], daemon: [] };

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const phone = new WebSocket(`${URL}?session=${SESSION_ID}&role=phone`);
const daemon = new WebSocket(`${URL}?session=${SESSION_ID}&role=daemon`);

phone.on('open', () => console.log('[PHONE] connected'));
daemon.on('open', () => {
  console.log('[DAEMON] connected');
  setTimeout(async () => {
    daemon.send(JSON.stringify({ type: 'tokens', payload: { model: 'claude-sonnet-4-5', inputTokens: 1200, outputTokens: 800, costUsd: 0.0086 }, timestamp: Date.now() }));
    daemon.send(JSON.stringify({ type: 'status', payload: { agentStatus: 'working', currentTask: 'Refactoring auth' }, timestamp: Date.now() }));
    daemon.send(JSON.stringify({ type: 'tool_call', payload: { tool: 'Read', input: 'src/auth.ts', timestamp: Date.now() }, timestamp: Date.now() }));
    daemon.send(JSON.stringify({ type: 'output', payload: { line: 'Read(src/auth.ts)', timestamp: Date.now() }, timestamp: Date.now() }));
    daemon.send(JSON.stringify({ type: 'agent_info', payload: { type: 'claude', model: 'claude-sonnet-4-5' }, timestamp: Date.now() }));
  }, 400);
});

phone.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  received.phone.push(msg.type);
  console.log('[PHONE recv]', msg.type);
  if (msg.type === 'tokens') {
    phone.send(JSON.stringify({ type: 'command', payload: { action: 'compact' }, timestamp: Date.now() }));
  }
});

daemon.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  received.daemon.push(msg.type);
  console.log('[DAEMON recv]', msg.type, JSON.stringify(msg.payload).slice(0,80));
});

phone.on('error', e => console.error('[PHONE error]', e.message));
daemon.on('error', e => console.error('[DAEMON error]', e.message));

setTimeout(() => {
  console.log('\n=== RELAY RESULTS ===');
  const checks = {
    'tokens→phone': received.phone.includes('tokens'),
    'status→phone': received.phone.includes('status'),
    'tool_call→phone': received.phone.includes('tool_call'),
    'output→phone': received.phone.includes('output'),
    'agent_info→phone': received.phone.includes('agent_info'),
    'command→daemon': received.daemon.includes('command'),
    'peer_connected→daemon': received.daemon.includes('peer_connected'),
  };
  Object.entries(checks).forEach(([k,v]) => console.log(v ? '✅' : '❌', k));
  const allPass = Object.values(checks).every(Boolean);
  console.log('\n', allPass ? '✅ ALL RELAY TESTS PASS' : '❌ SOME RELAY TESTS FAILED');
  phone.close(); daemon.close();
  process.exit(allPass ? 0 : 1);
}, 2500);
