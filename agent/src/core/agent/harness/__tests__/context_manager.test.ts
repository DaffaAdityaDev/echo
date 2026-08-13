import { HumanMessage, type SystemMessage } from "@langchain/core/messages";
import { ContextManager } from "../context_manager";

describe("ContextManager", () => {
  describe("prepareMessagesPayload", () => {
    const system = "You are a helpful assistant.";
    const env = "OS: Windows, CWD: /project";
    const msgs = [new HumanMessage("hello")];

    it("without prefix caching returns single system message", () => {
      const cm = new ContextManager({ enablePrefixCachingLayout: false });
      const result = cm.prepareMessagesPayload(system, env, msgs);
      expect(result).toHaveLength(2);
      expect((result[0] as SystemMessage).content.toString()).toContain(system);
      expect((result[0] as SystemMessage).content.toString()).toContain(env);
      expect(result[1]).toBe(msgs[0]);
    });

    it("with prefix caching splits system and env messages", () => {
      const cm = new ContextManager({ enablePrefixCachingLayout: true });
      const result = cm.prepareMessagesPayload(system, env, msgs);
      expect(result).toHaveLength(3);
      expect((result[0] as SystemMessage).content.toString()).toBe(system);
      expect((result[1] as SystemMessage).content.toString()).toContain(env);
      expect(result[2]).toBe(msgs[0]);
    });

    it("disabled config falls through to simple layout", () => {
      const cm = new ContextManager({ enabled: false });
      const result = cm.prepareMessagesPayload(system, env, msgs);
      expect(result).toHaveLength(2);
    });
  });
});
