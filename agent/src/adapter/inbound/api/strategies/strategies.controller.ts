import type { Context } from "hono";
import { strategyRegistry } from "../../../../core/agent/strategies";
import type { StrategiesResponse } from "./strategies.schema";

export function listStrategies(c: Context) {
  const strategies: StrategiesResponse = strategyRegistry.list();
  return c.json({ strategies });
}
