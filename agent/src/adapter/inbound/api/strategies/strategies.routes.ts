import { Hono } from "hono";
import { strategyRegistry } from "../../../../core/agent/strategies";

const strategiesRouter = new Hono();

strategiesRouter.get("/strategies", (c) => {
  return c.json({ strategies: strategyRegistry.list() });
});

export default strategiesRouter;
