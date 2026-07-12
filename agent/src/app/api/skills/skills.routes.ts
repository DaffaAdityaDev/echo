import { Hono } from "hono";
import { standardSkills } from "../../../core/agent/skills/library";

const skillsRouter = new Hono();

skillsRouter.get("/skills", (c) => {
    return c.json(
        standardSkills.map(s => ({
            name: s.name,
            description: s.description,
            preferredTools: s.preferredTools,
            modifiers: s.modifiers,
        }))
    );
});

export default skillsRouter;
