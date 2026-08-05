import { Hono } from "hono";
import { summarizeSession } from "./internal.controller";

const internalRouter = new Hono();

internalRouter.post("/sessions/summarize", summarizeSession);

export default internalRouter;
