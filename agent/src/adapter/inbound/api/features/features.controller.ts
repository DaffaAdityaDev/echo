import type { Context } from "hono";
import { getImplementedFeatures } from "../../../../core/agent/tools";
import type { FeaturesResponse } from "./features.schema";

export function getFeatures(c: Context) {
  const features: FeaturesResponse = getImplementedFeatures();
  return c.json(features);
}
