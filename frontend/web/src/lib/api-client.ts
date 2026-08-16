import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { extractErrorMessage } from "@/utils/error";
import { generateTraceContext } from "./telemetry-fetch";

const BASE_URL = "/api";

function setAuthHeaders(headers: { set: (k: string, v: string) => void }, body?: unknown): void {
  const { traceparent } = generateTraceContext();
  headers.set("traceparent", traceparent);

  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    const sid = typeof rec.sessionId === "string" ? rec.sessionId : undefined;
    if (sid) {
      headers.set("x-agent-session-id", sid);
    }
  }
}

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  setAuthHeaders(config.headers, config.data);
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isAuthPage = url.includes("/auth/login") || url.includes("/auth/register");
    const alreadyOnLogin = typeof window !== "undefined" && window.location.pathname === "/login";
    if (error.response?.status === 401 && typeof window !== "undefined" && !isAuthPage && !alreadyOnLogin) {
      window.location.href = "/login";
    }
    if (error.response) {
      throw new Error(extractErrorMessage(error.response.data, error.response.statusText));
    }
    throw new Error(extractErrorMessage(error.message, "Network error"));
  },
);

export type ApiRequestOptions = AxiosRequestConfig & {
  params?: Record<string, string>;
  onResponse?: (response: Response) => void;
};

async function request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { params, ...config } = options;

  const response = await client.request<T>({
    ...config,
    baseURL: BASE_URL,
    url: endpoint,
    params,
  });

  return response.data;
}

async function stream<T = unknown>(
  endpoint: string,
  body: unknown,
  onChunk: (data: T) => void,
  options: ApiRequestOptions = {},
) {
  const { signal } = options;

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  setAuthHeaders(headers, body);

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: signal as AbortSignal,
  });

  if (response.ok && options.onResponse) {
    options.onResponse(response);
  }

  await readStream(response, (data) => onChunk(data as T), signal as AbortSignal);
}

async function readStream(response: Response, onChunk: (data: unknown) => void, signal?: AbortSignal) {
  if (!response.ok) {
    const errorText = await response.text();
    let message = `Request failed with status ${response.status}`;
    try {
      message = extractErrorMessage(JSON.parse(errorText), message);
    } catch {
      message = errorText || message;
    }
    throw new Error(message);
  }

  if (!response.body) throw new Error("ReadableStream not supported");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let partialLine = "";
  let hasReceivedData = false;

  const contentType = response.headers.get("content-type") || "";
  const allowPlainText = PLAIN_TEXT_CONTENT_TYPES.some((t) => contentType.includes(t));

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) hasReceivedData = true;

    const chunk = decoder.decode(value, { stream: true });
    const lines = (partialLine + chunk).split("\n");
    partialLine = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith(":")) continue;

      let jsonStr = trimmedLine;
      if (trimmedLine.startsWith("data: ")) {
        jsonStr = trimmedLine.slice(6).trim();
      }

      if (jsonStr === "[DONE]") continue;
      if (!jsonStr) continue;

      const packet = parseStreamLine(jsonStr, allowPlainText);
      if (packet !== undefined) {
        onChunk(packet);
      }
    }
  }

  if (!hasReceivedData && signal?.aborted) {
    return;
  }
  if (!hasReceivedData) {
    throw new Error("Stream ended without receiving any data");
  }
}

// Echo backends always send JSON envelopes over SSE. Plain-text content is
// only accepted from endpoints that are explicitly text (text/plain,
// text/markdown); anywhere else a non-JSON line is a protocol violation and
// must surface as an error rather than silently becoming assistant content.
const PLAIN_TEXT_CONTENT_TYPES = ["text/plain", "text/markdown"] as const;

export function parseStreamLine(line: string, allowPlainText: boolean): unknown {
  if (line.startsWith("{")) {
    try {
      return JSON.parse(line);
    } catch {
      // Malformed JSON packet: drop it rather than fabricate a content packet.
      return undefined;
    }
  }
  if (allowPlainText) {
    return { content: line };
  }
  throw new Error(`Unexpected non-JSON data in stream: ${line.slice(0, 120)}`);
}

export const api = {
  get: <T>(url: string, opts?: ApiRequestOptions) => request<T>(url, { ...opts, method: "GET" }),
  post: <T>(url: string, body: unknown, opts?: ApiRequestOptions) =>
    request<T>(url, { ...opts, method: "POST", data: body }),
  put: <T>(url: string, body: unknown, opts?: ApiRequestOptions) =>
    request<T>(url, { ...opts, method: "PUT", data: body }),
  patch: <T>(url: string, body: unknown, opts?: ApiRequestOptions) =>
    request<T>(url, { ...opts, method: "PATCH", data: body }),
  delete: <T>(url: string, opts?: ApiRequestOptions) => request<T>(url, { ...opts, method: "DELETE" }),
  stream,
};
