import { Hono } from "hono";
import { listModels } from "./model.controller";

const modelRouter = new Hono();

modelRouter.get("/models", listModels);

export default modelRouter;
