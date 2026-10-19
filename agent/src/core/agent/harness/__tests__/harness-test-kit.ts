import { HumanMessage } from "@langchain/core/messages";
import type { Mock } from "vitest";
import { z } from "zod";
import type {
  AgentState,
  AgentStrategy,
  JsonObject,
  JsonValue,
  LLMProvider,
  ProviderEvent,
  ToolDefinition,
} from "../../../../shared/types";
import { NlahHarness } from "../harness";

export interface TestPacket {
  type: string;
  [key: string]: JsonValue | undefined;
}

interface MockProviderResult {
  provider: LLMProvider;
  stream: Mock;
}

export const fakeExecute = vi.fn<ToolDefinition["execute"]>();

export const FAKE_TOOL: ToolDefinition = {
  name: "fake_tool",
  description: "Fake tool used by harness tests",
  keywords: ["fake"],
  schema: z.object({}),
  execute: fakeExecute,
};

export function resetFakeExecute(): void {
  fakeExecute.mockReset();
  fakeExecute.mockImplementation(async () => ({ status: "success", summary: "did it", data: { ok: true } }));
}

export function fakeStrategy(): AgentStrategy {
  return {
    name: "agent",
    buildSystemPrompt: (state: AgentState) => `fake strategy system prompt for ${state.objective}`,
  };
}

export function makeProvider(
  script: Array<ProviderEvent[]>,
  options: { maxContextTokens?: number } = {},
): MockProviderResult {
  let call = 0;

  const stream = vi.fn(() => {
    const events = script[Math.min(call, script.length - 1)] ?? [];
    call += 1;

    return (async function* () {
      for (const event of events) {
        yield event;
      }
    })();
  });

  const provider: LLMProvider = {
    modelName: "fake-model",
    baseURL: "http://fake.local",
    maxContextTokens: options.maxContextTokens ?? 100000,
    stream,
    cleanupReasoning: vi.fn(async () => {}),
    validate: vi.fn(async () => {}),
  };

  return { provider, stream };
}

export function makeState(missionId: string, objective = "Test objective"): AgentState {
  return { missionId, objective, tasks: [], memory: {}, messages: [new HumanMessage(objective)] };
}

export function makeHarness(
  provider: LLMProvider,
  overrides: Partial<{
    missionId: string;
    tenantId: string;
    strategy: AgentStrategy;
    harnessConfig: JsonObject;
  }> = {},
): NlahHarness {
  return new NlahHarness({
    provider,
    strategy: overrides.strategy ?? fakeStrategy(),
    missionId: overrides.missionId ?? "mission-1",
    tenantId: overrides.tenantId ?? "tenant-1",
    tools: [FAKE_TOOL],
    harnessConfig: overrides.harnessConfig,
  });
}

export async function runHarness(
  harness: NlahHarness,
  state: AgentState,
  onPacket?: (packet: TestPacket) => Promise<void>,
): Promise<TestPacket[]> {
  const packets: TestPacket[] = [];

  const handler =
    onPacket ??
    (async (packet: TestPacket) => {
      packets.push(packet);
    });

  await harness.runMission(state, handler);

  return packets;
}
