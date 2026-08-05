import { Hono } from "hono";
import strategiesRouter from "../strategies.routes";

interface StrategyInfo {
  name: string;
  versions: Array<{ version: string; status: string; aliases: string[] }>;
}

interface StrategiesResponse {
  strategies: StrategyInfo[];
}

describe("Strategies Endpoint", () => {
  test("GET /strategies returns all registered strategies", async () => {
    const app = new Hono();
    app.route("/", strategiesRouter);

    const res = await app.request("/strategies");
    expect(res.status).toBe(200);
    const body = (await res.json()) as StrategiesResponse;
    expect(body.strategies).toHaveLength(2);
    const names = body.strategies.map((strategy) => strategy.name);
    expect(names).toEqual(expect.arrayContaining(["standard", "nlah"]));
  });

  test("strategies include version, status and alias metadata", async () => {
    const app = new Hono();
    app.route("/", strategiesRouter);

    const res = await app.request("/strategies");
    const body = (await res.json()) as StrategiesResponse;
    const standard = body.strategies.find((strategy) => strategy.name === "standard") as StrategyInfo;
    expect(standard.versions[0].version).toBe("standard:v1");
    expect(standard.versions[0].status).toBe("active");
    expect(standard.versions[0].aliases).toContain("chat");

    const nlah = body.strategies.find((strategy) => strategy.name === "nlah") as StrategyInfo;
    expect(nlah.versions[0].version).toBe("nlah:v1");
    expect(nlah.versions[0].status).toBe("active");
    expect(nlah.versions[0].aliases).toEqual(expect.arrayContaining(["agent", "deep-research"]));
  });
});
