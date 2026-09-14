import { EventEmitter } from "events";
import type { Response } from "express";

export type AdminEvent =
  | { type: "new_order";     payload: { id: string; customerName: string; customerEmail: string; total: number; status: string; createdAt: string; storeId?: string } }
  | { type: "order_updated"; payload: { id: string; status: string; storeId?: string } }
  | { type: "heartbeat";     payload: { ts: number } }
  | { type: "low_stock";     payload: { products: { id: string; name: string; stock: number }[]; threshold: number; checkedAt: string; storeId?: string } }
  | { type: "new_message";   payload: any }
  | { type: "channel_event"; payload: any };

class EventBus extends EventEmitter {
  private clients = new Map<string, Set<Response>>();

  addClient(res: Response, storeId: string) {
    if (!this.clients.has(storeId)) {
      this.clients.set(storeId, new Set());
    }
    this.clients.get(storeId)!.add(res);
    res.on("close", () => this.removeClient(res, storeId));
  }

  removeClient(res: Response, storeId: string) {
    const storeClients = this.clients.get(storeId);
    if (storeClients) {
      storeClients.delete(res);
      if (storeClients.size === 0) {
        this.clients.delete(storeId);
      }
    }
  }

  publish(event: AdminEvent & { storeId?: string }) {
    const data = `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
    const targetStoreId = event.storeId || (event.payload as any)?.storeId;

    if (targetStoreId) {
      const storeClients = this.clients.get(targetStoreId);
      if (storeClients) {
        for (const client of storeClients) {
          try { client.write(data); } catch { this.removeClient(client, targetStoreId); }
        }
      }
    } else {
      // Broadcast to all clients (e.g. heartbeat)
      for (const [sId, storeClients] of this.clients.entries()) {
        for (const client of storeClients) {
          try { client.write(data); } catch { this.removeClient(client, sId); }
        }
      }
    }
  }

  get clientCount() {
    let count = 0;
    for (const storeClients of this.clients.values()) {
      count += storeClients.size;
    }
    return count;
  }
}

export const eventBus = new EventBus();

// Heartbeat every 25 seconds to keep connections alive
setInterval(() => {
  eventBus.publish({ type: "heartbeat", payload: { ts: Date.now() } });
}, 25_000);
