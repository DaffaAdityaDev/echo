import { Hono } from "hono";
import { ACTIVE_FEATURES } from "../../../core/agent/tools/registry";

const featuresRouter = new Hono();

featuresRouter.get("/features", (c) => {
    return c.json(ACTIVE_FEATURES);
});

export default featuresRouter;
