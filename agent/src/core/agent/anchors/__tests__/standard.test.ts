import { SystemMessage } from "@langchain/core/messages";
import { StandardContextAnchor } from "../standard";

describe("StandardContextAnchor", () => {
  test("default year equals current year", () => {
    const anchor = new StandardContextAnchor();
    const message = anchor.build();

    expect(message).toBeInstanceOf(SystemMessage);
    expect(message.content).toBe(`<context_anchor>Current_Year: ${new Date().getFullYear()}</context_anchor>`);
  });

  test("custom year appears in content", () => {
    const anchor = new StandardContextAnchor();
    const message = anchor.build({ year: 2024 });

    expect(message.content).toContain("2024");
    expect(message.content).toBe("<context_anchor>Current_Year: 2024</context_anchor>");
  });

  test("content matches expected format and contains no location", () => {
    const anchor = new StandardContextAnchor();
    const message = anchor.build({ year: 2030 });

    expect(message.content).toMatch(/^<context_anchor>Current_Year: \d{4}<\/context_anchor>$/);
    expect(message.content).not.toMatch(/location/i);
    expect(message.content).not.toContain("Session_Start_Location");
  });

  test("two builds with different years differ", () => {
    const anchor = new StandardContextAnchor();
    const first = anchor.build({ year: 2024 });
    const second = anchor.build({ year: 2025 });

    expect(first.content).not.toBe(second.content);
  });
});
