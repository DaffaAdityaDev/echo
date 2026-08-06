import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { STORAGE_KEYS } from "@/constants";
import { generateTraceContext } from "./telemetry-fetch";

const BASE_URL = "/api";

function setAuthHeaders(headers: { set: (k: string, v: string) => void }, body?: unknown): void {
  const { traceparent } = generateTraceContext();
  headers.set("traceparent", traceparent);

  if (typeof window !== "undefined") {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    const sid =
      typeof rec.sessionId === "string" ? rec.sessionId : typeof rec.missionId === "string" ? rec.missionId : undefined;
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
    if (error.response?.status === 401 && typeof window !== "undefined" && !isAuthPage) {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      window.location.href = "/login";
    }
    if (error.response) {
      const msg = error.response.data?.message || error.response.data?.error || error.response.statusText;
      throw new Error(msg);
    }
    throw new Error(error.message || "Network error");
  },
);

export type ApiRequestOptions = AxiosRequestConfig & {
  params?: Record<string, string>;
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

  await readStream(response, onChunk, signal as AbortSignal);
}

async function streamGet<T = unknown>(endpoint: string, onChunk: (data: T) => void, options: ApiRequestOptions = {}) {
  const { signal } = options;

  const headers = new Headers();
  setAuthHeaders(headers, undefined);

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "GET",
    headers,
    signal: signal as AbortSignal,
  });

  await readStream(response, onChunk, signal as AbortSignal);
}

async function readStream<T = unknown>(response: Response, onChunk: (data: T) => void, signal?: AbortSignal) {
  if (!response.ok) {
    const errorText = await response.text();
    let message = `Request failed with status ${response.status}`;
    try {
      const parsed = JSON.parse(errorText);
      message = parsed.error || parsed.message || message;
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

      try {
        if (jsonStr.startsWith("{")) {
          onChunk(JSON.parse(jsonStr));
        } else {
          onChunk({ content: jsonStr } as T);
        }
      } catch {
        onChunk({ content: jsonStr } as T);
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
  streamGet,
};
