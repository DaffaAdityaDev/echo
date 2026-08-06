import { Hono } from "hono";
import { MISSION_ROUTES } from "./mission.constants";
import { createMission, handleHitlDecision, streamMissionLogs } from "./mission.controller";

const missionRouter = new Hono();

missionRouter.post(MISSION_ROUTES.GENERATE_MISSION, createMission);
missionRouter.post(MISSION_ROUTES.APPROVE, handleHitlDecision);
missionRouter.post(MISSION_ROUTES.DENY, handleHitlDecision);
missionRouter.get(MISSION_ROUTES.STREAM, streamMissionLogs);

export default missionRouter;
