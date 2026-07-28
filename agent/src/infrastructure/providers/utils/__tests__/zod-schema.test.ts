import { z } from "zod";
import { zodV4ToOpenAISchema } from "../zod-schema";

describe("zodV4ToOpenAISchema", () => {
  it("converts simple Zod object with string fields to OpenAI function schema", () => {
    const schema = z.object({
      name: z.string(),
      email: z.string(),
    });

    const result = zodV4ToOpenAISchema(schema);

    expect(result.type).toBe("object");
    expect(result.properties).toBeDefined();
    expect(result.properties.name).toEqual({ type: "string" });
    expect(result.properties.email).toEqual({ type: "string" });
    expect(result.required).toEqual(["name", "email"]);
    expect(result.$schema).toBeUndefined();
  });

  it("converts Zod object with number and boolean fields", () => {
    const schema = z.object({
      count: z.number(),
      active: z.boolean(),
    });

    const result = zodV4ToOpenAISchema(schema);

    expect(result.type).toBe("object");
    expect(result.properties.count).toEqual({ type: "number" });
    expect(result.properties.active).toEqual({ type: "boolean" });
    expect(result.required).toEqual(["count", "active"]);
  });

  it("handles optional fields correctly", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const result = zodV4ToOpenAISchema(schema);

    expect(result.properties.name).toEqual({ type: "string" });
    expect(result.properties.age).toEqual({ type: "number" });
    expect(result.required).toEqual(["name"]);
  });

  it("converts nested Zod objects to nested JSON Schema", () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        address: z.object({
          city: z.string(),
          zip: z.string(),
        }),
      }),
    });

    const result = zodV4ToOpenAISchema(schema);

    expect(result.type).toBe("object");
    expect(result.properties.user.type).toBe("object");
    expect(result.properties.user.properties.name).toEqual({ type: "string" });
    expect(result.properties.user.properties.address.type).toBe("object");
    expect(result.properties.user.properties.address.properties.city).toEqual({ type: "string" });
    expect(result.properties.user.properties.address.properties.zip).toEqual({ type: "string" });
  });

  it("handles enum fields", () => {
    const schema = z.object({
      role: z.enum(["admin", "user", "guest"]),
    });

    const result = zodV4ToOpenAISchema(schema);

    expect(result.properties.role.type).toBe("string");
    expect(result.properties.role.enum).toEqual(["admin", "user", "guest"]);
  });

  it("handles array fields", () => {
    const schema = z.object({
      tags: z.array(z.string()),
    });

    const result = zodV4ToOpenAISchema(schema);

    expect(result.properties.tags.type).toBe("array");
    expect(result.properties.tags.items).toEqual({ type: "string" });
  });
});
