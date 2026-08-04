import { Hono } from "hono";
import docsRouter from "./docs/docs";
import featuresRouter from "./features/features.routes";
import internalRouter from "./internal/internal.routes";
import missionRouter from "./missions/mission.routes";
import modelRouter from "./models/model.routes";
import skillsRouter from "./skills/skills.routes";
import strategiesRouter from "./strategies/strategies.routes";

const router = new Hono();

router.route("/", missionRouter);
router.route("/", modelRouter);
router.route("/", featuresRouter);
router.route("/", skillsRouter);
router.route("/", strategiesRouter);
router.route("/internal", internalRouter);
router.route("/docs", docsRouter);

export default router;
