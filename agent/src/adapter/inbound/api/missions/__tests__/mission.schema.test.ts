import { describe, expect, test } from "vitest";
import { createMissionSchema } from "../mission.schema";

describe("createMissionSchema Validation", () => {
  test("successfully parses payload with config containing only featureToggles", () => {
    const rawInput = {
      config: { featureToggles: {} },
      features: ["web_search", "write_todos"],
      message: "test",
      missionId: "b5948ef6-d000-4a5a-8605-51c48a07e5a2",
      model: "liquid/lfm2.5-1.2b",
      provider_config: {
        api_key: "admin123",
        base_url: "http://10.106.16.214:1234",
        model: "liquid/lfm2.5-1.2b",
        type: "lm-studio",
      },
      user_id: "1",
    };

    const result = createMissionSchema.safeParse(rawInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt).toBe("test");
      expect(result.data.config.harness).toBeDefined();
      expect(result.data.config.harness.maxIterations).toBe(15);
      expect(result.data.config.featureToggles).toEqual({});
    }
  });

  test("successfully parses payload without config object", () => {
    const rawInput = {
      message: "hello",
      provider_config: {
        base_url: "http://localhost:1234",
        model: "gpt-4o",
        type: "openai",
      },
    };

    const result = createMissionSchema.safeParse(rawInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt).toBe("hello");
      expect(result.data.config.harness).toBeDefined();
    }
  });
});
