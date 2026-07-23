import { Hono } from "hono";
import missionRouter from "./missions/mission.routes";
import modelRouter from "./models/model.routes";
import featuresRouter from "./features/features.routes";
import skillsRouter from "./skills/skills.routes";
import internalRouter from "./internal/internal.routes";
import docsRouter from "./docs/docs";

const router = new Hono();

router.route("/", missionRouter);
router.route("/", modelRouter);
router.route("/", featuresRouter);
router.route("/", skillsRouter);
router.route("/internal", internalRouter);
router.route("/docs", docsRouter);

export default router;
