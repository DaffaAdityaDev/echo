import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import openApiSpec from "../../../../../api/openapi.json" with { type: "json" };

const docsRouter = new Hono();

docsRouter.get(
  "/",
  apiReference({
    spec: {
      content: openApiSpec,
    },
    theme: "purple",
    pageTitle: "Echo Agent API Reference",
  }),
);

export default docsRouter;
