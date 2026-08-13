import { z } from "zod";
import type { CredentialManager } from "../../../../core/agent/credentials";
import { MCPClient } from "../client";

type MockedClient = {
  connect: ReturnType<typeof vi.fn>;
  listTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

const mockClientCtor = vi.hoisted(() =>
  vi.fn(
    class {
      connect = vi.fn();
      listTools = vi.fn();
      callTool = vi.fn();
      close = vi.fn();
    },
  ),
);

const mockSSEClientTransport = vi.hoisted(() =>
  vi.fn(
    class {
      url: URL;
      constructor(url: URL) {
        this.url = url;
      }
    },
  ),
);
const mockStdioClientTransport = vi.hoisted(() =>
  vi.fn(
    class {
      opts: { command: string; args?: string[] };
      constructor(opts: { command: string; args?: string[] }) {
        this.opts = opts;
      }
    },
  ),
);

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: mockClientCtor,
}));

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: mockSSEClientTransport,
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: mockStdioClientTransport,
}));

function getMockClient(): MockedClient {
  const instances = mockClientCtor.mock.instances;
  return instances[instances.length - 1] as unknown as MockedClient;
}

const toolDef = {
  name: "foo",
  description: "d",
  inputSchema: { type: "object", properties: { x: { type: "string" } } },
};

describe("MCPClient", () => {
  beforeEach(() => {
    vi.stubGlobal("Bun", { sleep: async () => {} });
    mockClientCtor.mockReset();
    mockSSEClientTransport.mockReset();
    mockStdioClientTransport.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("connect with sse builds SSEClientTransport and is idempotent", async () => {
    const client = new MCPClient({ name: "srv", url: "http://localhost:8080/sse", transport: "sse" });
    const mockClient = getMockClient();
    mockClient.connect.mockResolvedValue(undefined);

    await client.connect();
    expect(mockSSEClientTransport).toHaveBeenCalledTimes(1);
    expect(mockSSEClientTransport.mock.calls[0][0]).toBeInstanceOf(URL);
    expect((mockSSEClientTransport.mock.calls[0][0] as URL).href).toBe("http://localhost:8080/sse");
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(client.isConnected()).toBe(true);

    await client.connect();
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSSEClientTransport).toHaveBeenCalledTimes(1);
  });

  test("connect with stdio uses command and args", async () => {
    const client = new MCPClient({
      name: "srv",
      url: "http://fallback",
      transport: "stdio",
      command: "/usr/bin/npx",
      args: ["-y", "server"],
    });
    const mockClient = getMockClient();
    mockClient.connect.mockResolvedValue(undefined);

    await client.connect();
    expect(mockStdioClientTransport).toHaveBeenCalledWith({ command: "/usr/bin/npx", args: ["-y", "server"] });
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(client.isConnected()).toBe(true);
  });

  test("connect with stdio falls back to url as command", async () => {
    const client = new MCPClient({ name: "srv", url: "http://fallback", transport: "stdio" });
    const mockClient = getMockClient();
    mockClient.connect.mockResolvedValue(undefined);

    await client.connect();
    expect(mockStdioClientTransport).toHaveBeenCalledWith({ command: "http://fallback", args: undefined });
  });

  test("connect retries when client.connect rejects", async () => {
    const client = new MCPClient({ name: "srv", url: "http://localhost:8080/sse", transport: "sse" });
    const mockClient = getMockClient();
    mockClient.connect
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(undefined);

    await client.connect();
    expect(mockClient.connect).toHaveBeenCalledTimes(3);
    expect(client.isConnected()).toBe(true);
  });

  test("discoverTools converts inputSchema to a zod schema", async () => {
    const client = new MCPClient({ name: "srv", url: "http://localhost:8080/sse", transport: "sse" });
    const mockClient = getMockClient();
    mockClient.listTools.mockResolvedValue({ tools: [toolDef] });

    const tools = await client.discoverTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("foo");
    expect(tools[0].description).toBe("d");
    expect(tools[0].schema).toBeInstanceOf(z.ZodObject);
    expect(tools[0].schema.safeParse({ x: "hi" }).success).toBe(true);
    expect(client.getTools()).toHaveLength(1);
  });

  test("tool execute returns success observation", async () => {
    const client = new MCPClient({ name: "srv", url: "http://localhost:8080/sse", transport: "sse" });
    const mockClient = getMockClient();
    mockClient.listTools.mockResolvedValue({ tools: [toolDef] });
    mockClient.callTool.mockResolvedValue({ content: [{ type: "text", text: "hello" }] });

    const tools = await client.discoverTools();
    const obs = await tools[0].execute({ x: "hi" });
    expect(mockClient.callTool).toHaveBeenCalledWith({ name: "foo", arguments: { x: "hi" } });
    expect(obs).toEqual({ status: "success", summary: "hello" });
  });

  test("tool execute returns error observation when callTool rejects", async () => {
    const client = new MCPClient({ name: "srv", url: "http://localhost:8080/sse", transport: "sse" });
    const mockClient = getMockClient();
    mockClient.listTools.mockResolvedValue({ tools: [toolDef] });
    mockClient.callTool.mockRejectedValue(new Error("upstream down"));

    const tools = await client.discoverTools();
    const obs = await tools[0].execute({});
    expect(mockClient.callTool).toHaveBeenCalledTimes(3);
    expect(obs.status).toBe("error");
    expect(obs.summary).toBe("upstream down");
    expect(obs.error).toBe("upstream down");
  });

  test("injects credentials into tool arguments", async () => {
    vi.stubEnv("MCP_API_KEY", "secret");
    const credentialManager = {
      registerToolCredentials: vi.fn(),
      getMappings: vi.fn(() => [{ key: "apiKey", envRef: "MCP_API_KEY" }]),
    };
    const client = new MCPClient(
      {
        name: "srv",
        url: "http://localhost:8080/sse",
        transport: "sse",
        credentials: { apiKey: "$env.MCP_API_KEY" },
      },
      credentialManager as unknown as CredentialManager,
    );
    const mockClient = getMockClient();
    mockClient.listTools.mockResolvedValue({ tools: [toolDef] });
    mockClient.callTool.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });

    const tools = await client.discoverTools();
    const obs = await tools[0].execute({});
    expect(credentialManager.registerToolCredentials).toHaveBeenCalledWith("foo", { apiKey: "$env.MCP_API_KEY" });
    expect(mockClient.callTool).toHaveBeenCalledWith({ name: "foo", arguments: { apiKey: "secret" } });
    expect(obs.status).toBe("success");
  });

  test("disconnect closes client and clears state", async () => {
    const client = new MCPClient({ name: "srv", url: "http://localhost:8080/sse", transport: "sse" });
    const mockClient = getMockClient();
    mockClient.connect.mockResolvedValue(undefined);
    mockClient.close.mockResolvedValue(undefined);

    await client.connect();
    expect(client.isConnected()).toBe(true);

    await client.disconnect();
    expect(mockClient.close).toHaveBeenCalledTimes(1);
    expect(client.isConnected()).toBe(false);
    expect(client.getTools()).toHaveLength(0);

    await client.disconnect();
    expect(mockClient.close).toHaveBeenCalledTimes(1);
  });
});
