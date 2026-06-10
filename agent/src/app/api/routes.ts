import { Hono } from "hono";
import missionRouter from "./missions/mission.routes";
import modelRouter from "./models/model.routes";

const router = new Hono();

router.route("/", missionRouter);
router.route("/", modelRouter);

export default router;
