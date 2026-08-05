import { Hono } from "hono";
import { getFeatures } from "./features.controller";

const featuresRouter = new Hono();

featuresRouter.get("/features", getFeatures);

export default featuresRouter;
