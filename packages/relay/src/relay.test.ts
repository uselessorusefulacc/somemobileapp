import { describe, expect, test, mock, spyOn, beforeEach, afterEach } from "bun:test";
import { SessionManager } from "./session";
import type { PeerRole, RelayMessage } from "./types";
import type { ServerWebSocket } from "bun";

describe("WebSocket SessionManager", () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    sessionManager.destroy();
  });

  test("getOrCreate session initialization", () => {
    const session = sessionManager.getOrCreate("550e8400-e29b-41d4-a716-446655440000");
    expect(session).toBeDefined();
    expect(session.sessionId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(session.phone).toBeNull();
    expect(session.daemon).toBeNull();
    expect(session.messageQueue).toBeEmpty();
  });

  test("registerPeer assigns socket to role and notifies other peer", () => {
    const sessionId = "550e8400-e29b-41d4-a716-446655440000";

    const mockSend = mock(() => {});
    const mockSocket = {
      send: mockSend,
      readyState: WebSocket.OPEN,
    } as unknown as ServerWebSocket<unknown>;

    // Register phone
    const successPhone = sessionManager.registerPeer(sessionId, "phone", mockSocket);
    expect(successPhone).toBeTrue();
    const session = sessionManager.getOrCreate(sessionId);
    expect(session.phone).toBe(mockSocket);

    // Register daemon
    const mockSendDaemon = mock(() => {});
    const mockSocketDaemon = {
      send: mockSendDaemon,
      readyState: WebSocket.OPEN,
    } as unknown as ServerWebSocket<unknown>;

    const successDaemon = sessionManager.registerPeer(sessionId, "daemon", mockSocketDaemon);
    expect(successDaemon).toBeTrue();
    expect(session.daemon).toBe(mockSocketDaemon);

    // After both are registered, peer_connected should be sent to both
    expect(mockSend).toHaveBeenCalled();
    expect(mockSendDaemon).toHaveBeenCalled();

    // Check payload structure sent to phone
    const lastSentToPhone = JSON.parse(mockSend.mock.calls[0][0] as string);
    expect(lastSentToPhone.type).toBe("peer_connected");
    expect(lastSentToPhone.payload.role).toBe("daemon");

    // Check payload structure sent to daemon
    const lastSentToDaemon = JSON.parse(mockSendDaemon.mock.calls[0][0] as string);
    expect(lastSentToDaemon.type).toBe("peer_connected");
    expect(lastSentToDaemon.payload.role).toBe("phone");
  });

  test("rejects double register for same role", () => {
    const sessionId = "550e8400-e29b-41d4-a716-446655440000";
    const mockSocket1 = { send: () => {} } as unknown as ServerWebSocket<unknown>;
    const mockSocket2 = { send: () => {} } as unknown as ServerWebSocket<unknown>;

    expect(sessionManager.registerPeer(sessionId, "phone", mockSocket1)).toBeTrue();
    expect(sessionManager.registerPeer(sessionId, "phone", mockSocket2)).toBeFalse();
  });

  test("removePeer disconnects clean and notifies partner", () => {
    const sessionId = "550e8400-e29b-41d4-a716-446655440000";
    const mockPhoneSend = mock(() => {});
    const mockPhone = { send: mockPhoneSend, readyState: WebSocket.OPEN } as unknown as ServerWebSocket<unknown>;
    const mockDaemon = { send: () => {}, readyState: WebSocket.OPEN } as unknown as ServerWebSocket<unknown>;

    sessionManager.registerPeer(sessionId, "phone", mockPhone);
    sessionManager.registerPeer(sessionId, "daemon", mockDaemon);

    sessionManager.removePeer(sessionId, "daemon");
    const session = sessionManager.getOrCreate(sessionId);
    expect(session.daemon).toBeNull();

    // Phone should receive peer_disconnected message
    const lastSent = JSON.parse(mockPhoneSend.mock.calls[1][0] as string);
    expect(lastSent.type).toBe("peer_disconnected");
    expect(lastSent.payload.role).toBe("daemon");
  });

  test("forwardMessage forwards directly when target is open", () => {
    const sessionId = "550e8400-e29b-41d4-a716-446655440000";
    const mockPhoneSend = mock(() => {});
    const mockPhone = { send: mockPhoneSend, readyState: WebSocket.OPEN } as unknown as ServerWebSocket<unknown>;
    const mockDaemon = { send: () => {}, readyState: WebSocket.OPEN } as unknown as ServerWebSocket<unknown>;

    sessionManager.registerPeer(sessionId, "phone", mockPhone);
    sessionManager.registerPeer(sessionId, "daemon", mockDaemon);

    const testMsg: RelayMessage = {
      type: "tokens",
      payload: { model: "claude", costUsd: 0.1 },
      timestamp: Date.now(),
    };

    const forwarded = sessionManager.forwardMessage(sessionId, "daemon", testMsg);
    expect(forwarded).toBeTrue();
    expect(mockPhoneSend.mock.calls.length).toBe(2); // 1 for peer_connected, 1 for forwarded message
    const lastSent = JSON.parse(mockPhoneSend.mock.calls[1][0] as string);
    expect(lastSent.type).toBe("tokens");
    expect(lastSent.payload.model).toBe("claude");
  });

  test("forwardMessage queues messages from daemon when phone is offline", () => {
    const sessionId = "550e8400-e29b-41d4-a716-446655440000";
    const mockDaemon = { send: () => {}, readyState: WebSocket.OPEN } as unknown as ServerWebSocket<unknown>;

    sessionManager.registerPeer(sessionId, "daemon", mockDaemon);

    const testMsg: RelayMessage = {
      type: "tokens",
      payload: { model: "gpt-4", costUsd: 0.05 },
      timestamp: Date.now(),
    };

    const forwarded = sessionManager.forwardMessage(sessionId, "daemon", testMsg);
    expect(forwarded).toBeFalse(); // Not forwarded because phone is offline

    const session = sessionManager.getOrCreate(sessionId);
    expect(session.messageQueue.length).toBe(1);
    expect(session.messageQueue[0].type).toBe("tokens");
  });

  test("rate limiter returns false after exceeding rate limit", () => {
    const sessionId = "550e8400-e29b-41d4-a716-446655440000";
    const mockPhone = { send: () => {}, readyState: WebSocket.OPEN } as unknown as ServerWebSocket<unknown>;
    sessionManager.registerPeer(sessionId, "phone", mockPhone);

    const testMsg: RelayMessage = {
      type: "tokens",
      payload: {},
      timestamp: Date.now(),
    };

    // Forward 100 messages within rate limit (from daemon to phone, which is online)
    for (let i = 0; i < 100; i++) {
      expect(sessionManager.forwardMessage(sessionId, "daemon", testMsg)).toBeTrue();
    }
    // 101st message should trigger rate limiting and fail
    expect(sessionManager.forwardMessage(sessionId, "daemon", testMsg)).toBeFalse();
  });
});
