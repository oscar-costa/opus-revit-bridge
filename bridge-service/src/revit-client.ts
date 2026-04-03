import net from "node:net";
import type { RevitRequest, RevitResponse } from "./types.js";

const PIPE_PATH = process.platform === "win32"
  ? "\\\\.\\pipe\\opus-revit-bridge"
  : "/tmp/opus-revit-bridge.sock";

export class RevitClient {
  private socket: net.Socket | null = null;
  private buffer = "";

  async ensureConnected(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(PIPE_PATH);

      socket.once("connect", () => {
        this.socket = socket;
        this.buffer = "";
        socket.on("data", (chunk: Buffer) => {
          this.buffer += chunk.toString("utf8");
        });
        resolve();
      });

      socket.once("error", (error: Error) => {
        this.socket = null;
        reject(new Error(
          `Could not connect to the Revit plugin at ${PIPE_PATH}: ${error.message}. ` +
          "Ensure Revit is open and the Opus bridge add-in is loaded."
        ));
      });
    });
  }

  async send<T>(request: RevitRequest, timeoutMs = 15_000): Promise<T> {
    await this.ensureConnected();
    const socket = this.socket;

    if (!socket) {
      throw new Error("Revit socket is not connected.");
    }

    return new Promise<T>((resolve, reject) => {
      let settled = false;

      const complete = (action: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        socket.off("data", onData);
        socket.off("error", onError);
        action();
      };

      const timer = setTimeout(() => {
        this.socket?.destroy();
        this.socket = null;
        complete(() => reject(new Error(
          `Revit did not respond within ${timeoutMs / 1000}s. ` +
          "The request may be blocked by a modal dialog or a busy UI thread."
        )));
      }, timeoutMs);

      const onError = (error: Error): void => {
        this.socket = null;
        complete(() => reject(new Error(`Socket error: ${error.message}`)));
      };

      const tryConsume = (): void => {
        const newlineIndex = this.buffer.indexOf("\n");
        if (newlineIndex === -1) {
          return;
        }

        const raw = this.buffer.slice(0, newlineIndex).trim();
        this.buffer = this.buffer.slice(newlineIndex + 1);

        try {
          const response = JSON.parse(raw) as RevitResponse<T>;
          if (response.error) {
            complete(() => reject(new Error(`Revit error: ${response.error}`)));
            return;
          }

          complete(() => resolve(response.result as T));
        } catch {
          complete(() => reject(new Error(`Could not parse Revit response: ${raw}`)));
        }
      };

      const onData = (): void => tryConsume();
      socket.on("data", onData);
      socket.once("error", onError);

      tryConsume();

      socket.write(JSON.stringify(request) + "\n", "utf8", (error?: Error | null) => {
        if (error) {
          this.socket = null;
          complete(() => reject(new Error(`Write to Revit plugin failed: ${error.message}`)));
        }
      });
    });
  }
}
