import { Hono } from "hono";
import { modelController } from "./model.controller";

const modelRouter = new Hono();

modelRouter.get("/models", (c) => modelController.listModels(c));

export default modelRouter;
