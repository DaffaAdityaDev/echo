import { Hono } from "hono";
import { MISSION_ROUTES } from "./mission.constants";
import { createMission, handleCancelMission, handleHitlDecision } from "./mission.controller";

const missionRouter = new Hono();

missionRouter.post(MISSION_ROUTES.GENERATE_MISSION, createMission);
missionRouter.post(MISSION_ROUTES.APPROVE, handleHitlDecision);
missionRouter.post(MISSION_ROUTES.DENY, handleHitlDecision);
missionRouter.post(MISSION_ROUTES.CANCEL, handleCancelMission);

export default missionRouter;
