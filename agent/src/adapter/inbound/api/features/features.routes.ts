import { Hono } from "hono";
import { ACTIVE_FEATURES } from "../../../../core/agent/tools";

const featuresRouter = new Hono();

featuresRouter.get("/features", (c) => {
  return c.json(ACTIVE_FEATURES);
});

export default featuresRouter;
