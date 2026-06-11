import { Hono } from "hono";
import missionRouter from "./missions/mission.routes";
import modelRouter from "./models/model.routes";
import featuresRouter from "./features/features.routes";

const router = new Hono();

router.route("/", missionRouter);
router.route("/", modelRouter);
router.route("/", featuresRouter);

export default router;
