/**
 * Unified API Client for Next.js (Server & Client)
 * Handles standard JSON requests and Server-Sent Events (SSE) streaming.
 */

import { API_CONFIG, API_VERSION } from "@/constants";


export type ApiRequestOptions = RequestInit & {
  params?: Record<string, string>;
  version?: string;
};

const BASE_URL = `${API_CONFIG.BASE_URL}/${API_VERSION}`;

async function request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { params, version, ...init } = options;
  
  const targetBaseUrl = version ? `${API_CONFIG.BASE_URL}/${version}` : BASE_URL;
  const url = new URL(`${targetBaseUrl}${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
  }

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "An unexpected error occurred" }));
    throw new Error(error.message || response.statusText);
  }

  // Handle empty responses
  if (response.status === 204) return {} as T;

  return response.json();
}

/**
 * Stream handler for SSE
 */
async function stream<T = unknown>(
  endpoint: string, 
  body: unknown, 
  onChunk: (data: T) => void,
  options: ApiRequestOptions = {}
) {
  const { version, ...restOptions } = options;
  const targetBaseUrl = version ? `${API_CONFIG.BASE_URL}/${version}` : BASE_URL;

  const response = await fetch(`${targetBaseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...restOptions.headers,
    },
    body: JSON.stringify(body),
    ...restOptions,
  });

  if (!response.body) throw new Error("ReadableStream not supported");
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let partialLine = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = (partialLine + chunk).split("\n");
    partialLine = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

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
      } catch (e) {
        onChunk({ content: jsonStr } as T);
      }
    }
  }
}

export const api = {
  get: <T>(url: string, opts?: ApiRequestOptions) => request<T>(url, { ...opts, method: "GET" }),
  post: <T>(url: string, body: unknown, opts?: ApiRequestOptions) => 
    request<T>(url, { ...opts, method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown, opts?: ApiRequestOptions) => 
    request<T>(url, { ...opts, method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(url: string, opts?: ApiRequestOptions) => request<T>(url, { ...opts, method: "DELETE" }),
  stream,
};

