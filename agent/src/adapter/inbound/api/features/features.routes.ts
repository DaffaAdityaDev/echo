import { Hono } from "hono";
import { getImplementedFeatures } from "../../../../core/agent/tools";

const featuresRouter = new Hono();

featuresRouter.get("/features", (c) => {
  return c.json(getImplementedFeatures());
});

export default featuresRouter;
