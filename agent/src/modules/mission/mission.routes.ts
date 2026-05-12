import { Hono } from "hono";
import { missionController } from "./mission.controller";

const router = new Hono();

router.post("/generate-mission", (c) => missionController.generateMission(c));

export default router;
