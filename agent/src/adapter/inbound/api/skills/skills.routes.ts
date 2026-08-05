import { Hono } from "hono";
import { listSkills } from "./skills.controller";

const skillsRouter = new Hono();

skillsRouter.get("/skills", listSkills);

export default skillsRouter;
