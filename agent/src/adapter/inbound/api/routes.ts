import { Hono } from "hono";
import docsRouter from "./docs/docs";
import featuresRouter from "./features/features.routes";
import internalRouter from "./internal/internal.routes";
import missionRouter from "./missions/mission.routes";
import modelRouter from "./models/model.routes";
import skillsRouter from "./skills/skills.routes";
import strategiesRouter from "./strategies/strategies.routes";

const router = new Hono();

router.route("/v1", missionRouter);
router.route("/v1", modelRouter);
router.route("/v1", featuresRouter);
router.route("/v1", skillsRouter);
router.route("/v1", strategiesRouter);
router.route("/v1/internal", internalRouter);
router.route("/docs", docsRouter);

export default router;
