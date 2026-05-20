import type { CommandMessage } from "./types";
import type { RelayClient } from "./relay-client";

export class CommandExecutor {
  private relay: RelayClient;
  private childPid?: number;

  constructor(relay: RelayClient) {
    this.relay = relay;
  }

  setChildPid(pid: number) {
    this.childPid = pid;
  }

  execute(cmd: CommandMessage) {
    console.log(`[Daemon] Executing command: ${cmd.action}`, cmd.params);

    switch (cmd.action) {
      case "pause":
        this.pause();
        break;
      case "resume":
        this.resume();
        break;
      case "compact":
        this.compact();
        break;
      case "switch_model":
        this.switchModel(cmd.params?.model as string | undefined);
        break;
      case "status":
        this.sendStatus();
        break;
      default:
        console.warn(`[Daemon] Unknown command: ${cmd.action}`);
    }
  }

  private pause() {
    if (this.childPid) {
      try {
        process.kill(this.childPid, "SIGINT");
        console.log(`[Daemon] Sent SIGINT to child process ${this.childPid}`);
      } catch (e) {
        console.error("[Daemon] Failed to pause:", e);
      }
    } else {
      console.log("[Daemon] No child process tracked; pause is a no-op");
    }
  }

  private resume() {
    console.log("[Daemon] Resume not implemented (agent must be restarted manually)");
  }

  private compact() {
    console.log("[Daemon] /compact command received — agent should handle this if it supports compacting");
    // In the future, this could write to stdin of a tracked process
  }

  private switchModel(model?: string) {
    if (!model) {
      console.warn("[Daemon] switch_model missing params.model");
      return;
    }
    console.log(`[Daemon] Requested model switch to: ${model}`);
    // Agents typically handle this via their own config or CLI flags
  }

  private sendStatus() {
    this.relay.sendStatus("working");
  }
}
