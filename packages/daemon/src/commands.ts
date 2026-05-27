import type { CommandMessage } from "./types";
import type { RelayClient } from "./relay-client";
import { ChildProcess } from "child_process";
import { Writable } from "stream";

export class CommandExecutor {
  private relay: RelayClient;
  private child: ChildProcess | null = null;
  private paused = false;

  constructor(relay: RelayClient) {
    this.relay = relay;
  }

  setChild(child: ChildProcess) {
    this.child = child;
  }

  execute(cmd: CommandMessage) {
    console.log(`[Daemon] ← command: ${cmd.action}`, cmd.params ?? "");
    switch (cmd.action) {
      case "pause":    this.pause();                                    break;
      case "resume":   this.resume();                                   break;
      case "kill":     this.kill();                                     break;
      case "compact":  this.compact();                                  break;
      case "inject":   this.inject(String(cmd.params?.text ?? ""));     break;
      case "switch_model": this.switchModel(String(cmd.params?.model ?? "")); break;
      case "status":   this.sendStatus();                               break;
      default: console.warn(`[Daemon] Unknown command: ${cmd.action}`);
    }
  }

  private pause() {
    if (!this.child?.pid) {
      console.log("[Daemon] pause: no child process");
      return;
    }
    try {
      // SIGSTOP on unix, SIGINT on windows
      if (process.platform === "win32") {
        process.kill(this.child.pid, "SIGINT");
      } else {
        process.kill(this.child.pid, "SIGSTOP");
        this.paused = true;
      }
      this.relay.sendStatus("paused", "Paused by phone");
      console.log(`[Daemon] Paused PID ${this.child.pid}`);
    } catch (e) {
      console.error("[Daemon] pause error:", e);
    }
  }

  private resume() {
    if (!this.child?.pid) return;
    try {
      if (process.platform !== "win32") {
        process.kill(this.child.pid, "SIGCONT");
        this.paused = false;
      }
      this.relay.sendStatus("working", "Resumed");
      console.log(`[Daemon] Resumed PID ${this.child.pid}`);
    } catch (e) {
      console.error("[Daemon] resume error:", e);
    }
  }

  private kill() {
    if (!this.child?.pid) {
      console.log("[Daemon] kill: no child process to kill");
      return;
    }
    try {
      this.child.kill("SIGTERM");
      setTimeout(() => {
        if (this.child && !this.child.killed) {
          this.child.kill("SIGKILL");
        }
      }, 3000);
      this.relay.sendStatus("exited", "Killed by phone");
      console.log(`[Daemon] Killed PID ${this.child.pid}`);
    } catch (e) {
      console.error("[Daemon] kill error:", e);
    }
  }

  private compact() {
    // Send /compact to the agent stdin — works for claude, opencode
    this.inject("/compact");
    console.log("[Daemon] Sent /compact to agent stdin");
  }

  private inject(text: string) {
    if (!text) return;
    text = text.replace(/[^\x20-\x7E\n]/g, "").slice(0, 2000);
    if (!text) return;
    const stdin = this.child?.stdin;
    if (!stdin || !stdin.writable) {
      console.log("[Daemon] inject: agent stdin not writable");
      return;
    }
    const writeable = stdin as Writable;
    writeable.write(text + "\n", (err) => {
      if (err) console.error("[Daemon] stdin write error:", err);
      else console.log(`[Daemon] Injected to stdin: ${text.slice(0, 80)}`);
    });
  }

  private switchModel(model: string) {
    if (!model) return;
    console.log(`[Daemon] Model switch requested: ${model} (agent must support hot-switch)`);
    // Claude Code supports: /model <name>
    this.inject(`/model ${model}`);
  }

  private sendStatus() {
    this.relay.sendStatus(this.paused ? "paused" : "working");
  }
}
