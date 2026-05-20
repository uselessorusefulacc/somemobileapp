const RELAY_URL = process.env.RELAY_URL ?? "ws://localhost:8082";
const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function connect(role: "phone" | "daemon"): WebSocket {
  const url = `${RELAY_URL}?session=${SESSION_ID}&role=${role}`;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log(`[${role}] Connected`);
  };

  ws.onmessage = (ev: MessageEvent) => {
    console.log(`[${role}] Received:`, String(ev.data).slice(0, 200));
  };

  ws.onclose = (ev: CloseEvent) => {
    console.log(`[${role}] Closed: ${ev.code} ${ev.reason}`);
  };

  ws.onerror = (ev: Event) => {
    console.error(`[${role}] Error:`, ev);
  };

  return ws;
}

async function runTest(): Promise<void> {
  console.log("=== Relay Test Client ===\n");

  const phone = connect("phone");
  await sleep(500);
  const daemon = connect("daemon");
  await sleep(500);

  await sleep(300);

  for (let i = 0; i < 5; i++) {
    daemon.send(
      JSON.stringify({
        type: "tokens",
        payload: {
          model: "claude-sonnet-4-5",
          inputTokens: 1000 + i * 100,
          outputTokens: 500 + i * 50,
          costUsd: 0.005 + i * 0.001,
        },
        timestamp: Date.now(),
      })
    );
    await sleep(100);
  }

  await sleep(200);
  phone.send(
    JSON.stringify({
      type: "command",
      payload: { action: "pause" },
      timestamp: Date.now(),
    })
  );

  await sleep(500);

  console.log("\n=== Test complete ===");
  phone.close();
  daemon.close();
  process.exit(0);
}

runTest().catch((e: unknown) => {
  console.error("Test failed:", e);
  process.exit(1);
});
