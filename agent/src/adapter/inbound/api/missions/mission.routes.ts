import { Hono } from "hono";
import { MISSION_ROUTES } from "./mission.constants";
import { missionController } from "./mission.controller";

const missionRouter = new Hono();

missionRouter.post(MISSION_ROUTES.GENERATE_MISSION, (c) => missionController.createMission(c));
missionRouter.post(MISSION_ROUTES.APPROVE, (c) => missionController.handleHitlDecision(c));
missionRouter.post(MISSION_ROUTES.DENY, (c) => missionController.handleHitlDecision(c));

export default missionRouter;
