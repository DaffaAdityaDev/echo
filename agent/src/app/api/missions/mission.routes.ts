import { Hono } from "hono";
import { missionController } from "./mission.controller";
import { MISSION_ROUTES } from "./mission.constants";

const missionRouter = new Hono();

missionRouter.post(MISSION_ROUTES.GENERATE_MISSION, (c) => missionController.createMission(c));

export default missionRouter;
