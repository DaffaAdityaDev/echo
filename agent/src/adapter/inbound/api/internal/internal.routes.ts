import { Hono } from "hono";
import { summarizeSession } from "./internal.controller";
import { tokenize } from "./tokenize.controller";

const internalRouter = new Hono();

internalRouter.post("/sessions/summarize", summarizeSession);
internalRouter.post("/tokenize", tokenize);

export default internalRouter;
