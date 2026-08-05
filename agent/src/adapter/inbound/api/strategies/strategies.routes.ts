import { Hono } from "hono";
import { listStrategies } from "./strategies.controller";

const strategiesRouter = new Hono();

strategiesRouter.get("/strategies", listStrategies);

export default strategiesRouter;
