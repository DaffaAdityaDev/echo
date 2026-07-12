import { Hono } from "hono";
import { handleSummarize } from "./summarize";

const internalRouter = new Hono();

internalRouter.post("/sessions/summarize", handleSummarize);

export default internalRouter;
