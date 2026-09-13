import { EventEmitter } from "events";
import type { Response } from "express";

export type AdminEvent =
  | { type: "new_order";     payload: { id: string; customerName: string; customerEmail: string; total: number; status: string; createdAt: string } }
  | { type: "order_updated"; payload: { id: string; status: string } }
  | { type: "heartbeat";     payload: { ts: number } }
  | { type: "low_stock";     payload: { products: { id: string; name: string; stock: number }[]; threshold: number; checkedAt: string } }
  | { type: "new_message";   payload: any }
  | { type: "channel_event"; payload: any };

class EventBus extends EventEmitter {
  private clients = new Set<Response>();

  addClient(res: Response) {
    this.clients.add(res);
    res.on("close", () => this.removeClient(res));
  }

  removeClient(res: Response) {
    this.clients.delete(res);
  }

  publish(event: AdminEvent) {
    const data = `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
    for (const client of this.clients) {
      try { client.write(data); } catch { this.removeClient(client); }
    }
  }

  get clientCount() { return this.clients.size; }
}

export const eventBus = new EventBus();

// Heartbeat every 25 seconds to keep connections alive
setInterval(() => {
  eventBus.publish({ type: "heartbeat", payload: { ts: Date.now() } });
}, 25_000);
