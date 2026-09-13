import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { eventBus } from "../lib/eventBus";

const router = Router();

router.get("/admin/events", requireAdmin, (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send connected acknowledgement
  res.write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now(), clients: eventBus.clientCount + 1 })}\n\n`);

  eventBus.addClient(res);

  req.on("close", () => {
    eventBus.removeClient(res);
  });
});

export default router;
