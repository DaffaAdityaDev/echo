import { z } from "zod";
import { jsonSchemaToZod } from "../schema-converter";

describe("jsonSchemaToZod", () => {
  describe("string type", () => {
    test("converts simple string schema", () => {
      const schema = { type: "string" };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema).toBeInstanceOf(z.ZodString);
      expect(zodSchema.safeParse("hello").success).toBe(true);
      expect(zodSchema.safeParse(42).success).toBe(false);
    });

    test("converts string with description", () => {
      const schema = { type: "string", description: "A name field" };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema.description).toBe("A name field");
    });

    test("converts string enum to ZodEnum", () => {
      const schema = { type: "string", enum: ["red", "green", "blue"] };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema).toBeInstanceOf(z.ZodEnum);
      expect(zodSchema.safeParse("red").success).toBe(true);
      expect(zodSchema.safeParse("yellow").success).toBe(false);
    });

    test("handles empty enum as plain string", () => {
      const schema = { type: "string", enum: [] };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema).toBeInstanceOf(z.ZodString);
    });
  });

  describe("number type", () => {
    test("converts number schema", () => {
      const schema = { type: "number" };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema).toBeInstanceOf(z.ZodNumber);
      expect(zodSchema.safeParse(3.14).success).toBe(true);
      expect(zodSchema.safeParse("abc").success).toBe(false);
    });

    test("converts integer schema to ZodNumber with int constraint", () => {
      const schema = { type: "integer" };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema.safeParse(42).success).toBe(true);
      expect(zodSchema.safeParse(3.14).success).toBe(false);
    });

    test("converts number with description", () => {
      const schema = { type: "number", description: "Age in years" };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema.description).toBe("Age in years");
    });
  });

  describe("boolean type", () => {
    test("converts boolean schema", () => {
      const schema = { type: "boolean" };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema).toBeInstanceOf(z.ZodBoolean);
      expect(zodSchema.safeParse(true).success).toBe(true);
      expect(zodSchema.safeParse("true").success).toBe(false);
    });

    test("converts boolean with description", () => {
      const schema = { type: "boolean", description: "Active flag" };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema.description).toBe("Active flag");
    });
  });

  describe("object type", () => {
    test("converts simple object schema", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["name"],
      };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema).toBeInstanceOf(z.ZodObject);

      const result = zodSchema.safeParse({ name: "Alice", age: 30 });
      expect(result.success).toBe(true);

      const missingRequired = zodSchema.safeParse({ age: 30 });
      expect(missingRequired.success).toBe(false);

      const optionalField = zodSchema.safeParse({ name: "Bob" });
      expect(optionalField.success).toBe(true);
    });

    test("converts nested object schema", () => {
      const schema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              address: {
                type: "object",
                properties: {
                  city: { type: "string" },
                  zip: { type: "string" },
                },
                required: ["city"],
              },
            },
            required: ["name"],
          },
        },
        required: ["user"],
      };
      const zodSchema = jsonSchemaToZod(schema);
      const valid = zodSchema.safeParse({
        user: { name: "Alice", address: { city: "NYC", zip: "10001" } },
      });
      expect(valid.success).toBe(true);

      const invalid = zodSchema.safeParse({ user: { address: { city: "NYC" } } });
      expect(invalid.success).toBe(false);
    });

    test("converts object with description", () => {
      const schema = {
        type: "object",
        description: "A user profile",
        properties: { name: { type: "string" } },
      };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema.description).toBe("A user profile");
    });

    test("handles empty properties object", () => {
      const schema = { type: "object", properties: {} };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema.safeParse({}).success).toBe(true);
    });
  });

  describe("array type", () => {
    test("converts array of strings", () => {
      const schema = { type: "array", items: { type: "string" } };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema).toBeInstanceOf(z.ZodArray);
      expect(zodSchema.safeParse(["a", "b"]).success).toBe(true);
      expect(zodSchema.safeParse([1, 2]).success).toBe(false);
    });

    test("converts array of objects", () => {
      const schema = {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "integer" }, label: { type: "string" } },
          required: ["id"],
        },
      };
      const zodSchema = jsonSchemaToZod(schema);
      const valid = zodSchema.safeParse([{ id: 1, label: "A" }, { id: 2 }]);
      expect(valid.success).toBe(true);

      const invalid = zodSchema.safeParse([{ label: "missing-id" }]);
      expect(invalid.success).toBe(false);
    });

    test("converts array with description", () => {
      const schema = {
        type: "array",
        description: "A list of items",
        items: { type: "string" },
      };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema.description).toBe("A list of items");
    });
  });

  describe("fallback", () => {
    test("returns z.any() for unknown schema type", () => {
      const schema = { type: "unknown_type" };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema).toBeInstanceOf(z.ZodAny);
      expect(zodSchema.safeParse("anything").success).toBe(true);
      expect(zodSchema.safeParse(42).success).toBe(true);
    });

    test("returns z.any() for empty schema", () => {
      const schema = {};
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema).toBeInstanceOf(z.ZodAny);
    });
  });

  describe("required fields behavior", () => {
    test("marks properties in required array as required", () => {
      const schema = {
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: "number" },
        },
        required: ["a"],
      };
      const zodSchema = jsonSchemaToZod(schema);
      const shape = (zodSchema as z.ZodObject<any>).shape;
      expect(shape.a).not.toBeInstanceOf(z.ZodOptional);
      expect(shape.b).toBeInstanceOf(z.ZodOptional);
    });

    test("all properties are optional when required is absent", () => {
      const schema = {
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: "number" },
        },
      };
      const zodSchema = jsonSchemaToZod(schema);
      const shape = (zodSchema as z.ZodObject<any>).shape;
      expect(shape.a).toBeInstanceOf(z.ZodOptional);
      expect(shape.b).toBeInstanceOf(z.ZodOptional);
    });
  });
});
