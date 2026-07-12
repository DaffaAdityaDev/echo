"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BookOpen, ArrowLeft, ShieldAlert, Info } from "lucide-react";
import { cn } from "@/utils/cn";
import { EndpointCard } from "@/components/docs/EndpointCard";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("getting-started");

  const sections = useMemo(() => [
    { id: "getting-started", label: "Getting Started" },
    { id: "authentication", label: "Authentication" },
    { id: "chat", label: "Chat Endpoints" },
    { id: "models", label: "Models" },
    { id: "api-keys", label: "API Keys (Admin)" },
    { id: "error-codes", label: "Error Codes" },
  ], []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col w-full overflow-x-hidden">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-blue-500" />
          <div>
            <span className="font-display font-bold text-sm tracking-tight block">ECHO API Docs</span>
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider font-sans">Reference Specifications</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ShieldAlert size={14} />
            Admin Console
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Orchestrator
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-6 py-8 gap-10">
        {/* Sidebar TOC */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3 px-3 font-sans">
                Table of Contents
              </h4>
              <nav className="space-y-1">
                {sections.map((section) => {
                  const active = activeSection === section.id;
                  return (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className={cn(
                        "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all relative",
                        active
                          ? "text-blue-500 bg-blue-500/5 font-semibold"
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50"
                      )}
                    >
                      {active && (
                        <div className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-blue-500 rounded-r" />
                      )}
                      {section.label}
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0" id="main-content">
          <div className="space-y-16 max-w-4xl pb-24">
      {/* Introduction */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold font-display tracking-tight text-zinc-100">
          API Documentation
        </h1>
        <p className="text-zinc-400 mt-2 leading-relaxed">
          Welcome to the Echo Orchestrator developer reference guide. Here you will find all the specifications, request schemas, response properties, and code examples needed to interact programmatically with our system.
        </p>
      </div>

      {/* Getting Started Section */}
      <section id="getting-started" className="space-y-6 scroll-mt-24">
        <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-100 border-b border-zinc-800 pb-3">
          Getting Started
        </h2>
        <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
          <p>
            The Echo system gateway routes and governs all operations. By default, the development base URL is:
          </p>
          <div className="bg-black/30 border border-zinc-800 rounded-lg p-3 font-mono text-zinc-300 w-fit select-all">
            http://localhost:8080/api/v1
          </div>
          <p>
            To authenticate requests, you must include a client JSON Web Token (JWT) or an administrator API Key in your request headers:
          </p>
          <CodeBlock
            language="http"
            code="Authorization: Bearer <your_jwt_token_here>"
          />
          <div className="p-4 border border-zinc-800/80 bg-zinc-900/10 rounded-xl flex gap-3.5 glass">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs">
              <strong>Authentication note:</strong> Public client endpoints require standard user JWT tokens. Administrator endpoints under `/admin` require authorization and access rights configured on your developer profile.
            </p>
          </div>
        </div>
      </section>

      {/* Authentication Section */}
      <section id="authentication" className="space-y-6 scroll-mt-24">
        <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-100 border-b border-zinc-800 pb-3">
          Authentication
        </h2>
        <div className="space-y-6">
          <EndpointCard
            method="POST"
            path="/auth/login"
            description="Authenticate system credentials to retrieve a user authorization token."
            requestFields={[
              {
                name: "email",
                type: "string",
                required: true,
                description: "Valid registered user email address.",
              },
              {
                name: "password",
                type: "string",
                required: true,
                description: "Plain text user account password.",
              },
            ]}
            responseFields={[
              {
                name: "token",
                type: "string",
                required: true,
                description: "Signed JWT bearer authorization token.",
              },
              {
                name: "user",
                type: "object",
                required: true,
                description: "User profile detail structure (id, name, email).",
              },
            ]}
            curlExample={`curl -X POST http://localhost:8080/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "password123"}'`}
          />

          <EndpointCard
            method="POST"
            path="/auth/register"
            description="Register a new system user account. Currently, registration is disabled in the prototype gateway."
            responseFields={[
              {
                name: "error",
                type: "string",
                required: true,
                description: "Description of the registration restriction. E.g. 'Not implemented yet'.",
              },
            ]}
            curlExample={`curl -X POST http://localhost:8080/api/v1/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email": "new@example.com", "password": "securepassword", "name": "Echo User"}'`}
          />
        </div>
      </section>

      {/* Chat Section */}
      <section id="chat" className="space-y-6 scroll-mt-24">
        <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-100 border-b border-zinc-800 pb-3">
          Chat Endpoints
        </h2>
        <div className="space-y-6">
          <EndpointCard
            method="POST"
            path="/chat"
            description="Send a message to the orchestrator model and receive a real-time Server-Sent Events (SSE) stream back. The stream transmits reasoning thoughts, subagent executions, and final Markdown content blocks."
            requestFields={[
              {
                name: "message",
                type: "string",
                required: true,
                description: "Primary user prompt string.",
              },
              {
                name: "model",
                type: "string",
                required: false,
                description: "LLM identifier model to process the query (e.g. gpt-4o).",
              },
              {
                name: "mode",
                type: "string",
                required: false,
                description: "Execution strategy: 'standard' | 'agent' | 'nlah' | 'react' | 'deep-research'.",
              },
              {
                name: "history",
                type: "array",
                required: false,
                description: "Preceding message history list of { role: 'user'|'assistant', content: string } objects.",
              },
              {
                name: "features",
                type: "array",
                required: false,
                description: "Feature catalog array of string IDs (e.g. ['web_search', 'code_execute']).",
              },
            ]}
            curlExample={`curl -X POST http://localhost:8080/api/v1/chat \\
  -H "Authorization: Bearer <jwt-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Write a python script that fetches currency data.",
    "model": "gpt-4o",
    "mode": "react",
    "features": ["code_execute"]
  }'`}
          />

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-zinc-300">SSE Event Format</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Every data event contains a JSON structure indicating event type. The structure implements standard `StreamPacket` parameters:
            </p>
            <CodeBlock
              language="json"
              code={`// Example SSE Reasoning Chunk
data: { "type": "reasoning", "content": "Analyzing user query for dependencies..." }

// Example SSE Subagent Call Chunk
data: { "type": "subagent_call", "subagent": { "name": "Code Specialist", "instruction": "Write script", "status": "calling" } }

// Example SSE Final content
data: { "type": "content", "content": "Here is the completed script..." }`}
            />
          </div>
        </div>
      </section>

      {/* Models Section */}
      <section id="models" className="space-y-6 scroll-mt-24">
        <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-100 border-b border-zinc-800 pb-3">
          Models
        </h2>
        <div className="space-y-6">
          <EndpointCard
            method="GET"
            path="/models"
            description="List all available large language models integrated and supported within the system."
            responseFields={[
              {
                name: "models",
                type: "array",
                required: true,
                description: "Array list of model objects, each having id and name properties.",
              },
            ]}
            curlExample={`curl -X GET http://localhost:8080/api/v1/models \\
  -H "Authorization: Bearer <jwt-token>"`}
          />
        </div>
      </section>

      {/* API Keys Section */}
      <section id="api-keys" className="space-y-6 scroll-mt-24">
        <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-100 border-b border-zinc-800 pb-3">
          API Keys (Admin)
        </h2>
        <div className="space-y-6">
          <EndpointCard
            method="GET"
            path="/admin/api-keys"
            description="Retrieve a list of all system API keys currently provisioned."
            responseFields={[
              {
                name: "id",
                type: "string",
                required: true,
                description: "Unique identifier for the key.",
              },
              {
                name: "name",
                type: "string",
                required: true,
                description: "Descriptive label assigned by the creator.",
              },
              {
                name: "prefix",
                type: "string",
                required: true,
                description: "First few characters of the secret token for reference.",
              },
              {
                name: "scopes",
                type: "array",
                required: true,
                description: "Authorized request scopes (e.g. ['read:chat', 'write:chat']).",
              },
              {
                name: "status",
                type: "string",
                required: true,
                description: "Operational status: 'active' | 'revoked'.",
              },
            ]}
            curlExample={`curl -X GET http://localhost:8080/api/v1/admin/api-keys \\
  -H "Authorization: Bearer <admin-jwt-token>"`}
          />

          <EndpointCard
            method="POST"
            path="/admin/api-keys"
            description="Create a new developer API key with custom scopes."
            requestFields={[
              {
                name: "name",
                type: "string",
                required: true,
                description: "Descriptive identifier name.",
              },
              {
                name: "scopes",
                type: "array",
                required: true,
                description: "Array of authorized scopes (e.g. ['read:chat', 'write:chat']).",
              },
            ]}
            responseFields={[
              {
                name: "key",
                type: "string",
                required: true,
                description: "The complete secret key token (only returned once!).",
              },
            ]}
            curlExample={`curl -X POST http://localhost:8080/api/v1/admin/api-keys \\
  -H "Authorization: Bearer <admin-jwt-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "External App Service", "scopes": ["read:chat"]}'`}
          />

          <EndpointCard
            method="DELETE"
            path="/admin/api-keys/:id"
            description="Immediately revoke an active API key, blocking any future requests using it."
            curlExample={`curl -X DELETE http://localhost:8080/api/v1/admin/api-keys/key_12345 \\
  -H "Authorization: Bearer <admin-jwt-token>"`}
          />
        </div>
      </section>

      {/* Error Codes Section */}
      <section id="error-codes" className="space-y-6 scroll-mt-24">
        <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-100 border-b border-zinc-800 pb-3">
          Error Codes
        </h2>
        <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
          <p>
            Echo API uses standard HTTP response codes to indicate success or failure of requests.
          </p>
          <div className="overflow-x-auto border border-zinc-800 bg-zinc-950/20 rounded-xl glass">
            <table className="w-full text-left border-collapse">
              <thead className="bg-zinc-900/50 border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Code</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Status</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Common Triggers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-xs">
                <tr className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-500">200</td>
                  <td className="px-4 py-3 font-semibold text-zinc-200">OK / Stream Start</td>
                  <td className="px-4 py-3 text-zinc-400">Success JSON payload or SSE stream starting.</td>
                </tr>
                <tr className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-amber-500">400</td>
                  <td className="px-4 py-3 font-semibold text-zinc-200">Bad Request</td>
                  <td className="px-4 py-3 text-zinc-400">Invalid payload format, validation failure, unknown model IDs.</td>
                </tr>
                <tr className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-red-500">401</td>
                  <td className="px-4 py-3 font-semibold text-zinc-200">Unauthorized</td>
                  <td className="px-4 py-3 text-zinc-400">Missing or invalid Authorization header token.</td>
                </tr>
                <tr className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-red-500">403</td>
                  <td className="px-4 py-3 font-semibold text-zinc-200">Forbidden</td>
                  <td className="px-4 py-3 text-zinc-400">Invalid internal token credentials or tier limits (requires Pro subscription).</td>
                </tr>
                <tr className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-zinc-500">404</td>
                  <td className="px-4 py-3 font-semibold text-zinc-200">Not Found</td>
                  <td className="px-4 py-3 text-zinc-400">Endpoint route or database entity does not exist.</td>
                </tr>
                <tr className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-red-600">500</td>
                  <td className="px-4 py-3 font-semibold text-zinc-200">Internal Server Error</td>
                  <td className="px-4 py-3 text-zinc-400">Go Gateway error, unreachable Hono Agent engine, database connection issues.</td>
                </tr>
                <tr className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-zinc-500">501</td>
                  <td className="px-4 py-3 font-semibold text-zinc-200">Not Implemented</td>
                  <td className="px-4 py-3 text-zinc-400">Endpoint route configured but feature implementation is pending.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
        </main>
      </div>
    </div>
  );
}
