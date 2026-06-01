import { Hono } from "hono";
import { QueueService } from "./queue.service";

const router = new Hono();

router.post("/queue-mission", async (c) => {
  const body = await c.req.json();
  const missionId = body.missionId || crypto.randomUUID();
  
  if (!body.message) {
    return c.json({ error: "Message prompt is required" }, 400);
  }

  const payload = {
    message: body.message,
    model: body.model,
    missionId,
    mode: body.mode || "standard",
    history: body.history || [],
  };

  const result = await QueueService.enqueue(payload);
  return c.json({ status: "queued", ...result });
});

router.get("/queue-status/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const status = await QueueService.getJobStatus(jobId);
  if (!status) {
    return c.json({ error: "Job not found" }, 404);
  }
  return c.json(status);
});

export default router;
