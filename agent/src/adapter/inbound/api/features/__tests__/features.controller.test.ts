import { Hono } from "hono";
import { LAZY_TOOLS } from "../../../../../core/agent/tools";
import featuresRouter from "../features.routes";

interface FeatureItem {
  id: string;
  name: string;
  description: string;
}

describe("Features Endpoint", () => {
  test("GET /features returns all implemented features", async () => {
    const app = new Hono();
    app.route("/", featuresRouter);

    const res = await app.request("/features");
    expect(res.status).toBe(200);
    const body = (await res.json()) as FeatureItem[];
    const expectedIds = Object.keys(LAZY_TOOLS).sort();
    expect(body.map((feature) => feature.id)).toEqual(expectedIds);
  });

  test("features have the expected shape", async () => {
    const app = new Hono();
    app.route("/", featuresRouter);

    const res = await app.request("/features");
    const body = (await res.json()) as FeatureItem[];
    for (const feature of body) {
      expect(typeof feature.id).toBe("string");
      expect(typeof feature.name).toBe("string");
      expect(typeof feature.description).toBe("string");
    }
  });
});
