import { appendFileSync } from "node:fs"

export const PROTOCOL_VERSION = "2026-07-28"
export const SERVER_INFO = {
  name: "mcp-probe",
  version: "0.1.0",
}

const TRACE_PATH = process.env.MCP_PROBE_TRACE || "/tmp/mcp-probe.ndjson"

const handles = new Map()

const docs = new Map([
  [
    "opencode-mcp-matrix",
    {
      id: "opencode-mcp-matrix",
      title: "OpenCode MCP Probe Notes",
      text:
        "This probe document helps test whether a client calls tools, sends per-request metadata, handles structuredContent, and exposes MCP resources or prompts.",
      url: "https://example.invalid/mcp-probe/opencode",
      metadata: { source: "mcp-probe", client: "opencode" },
    },
  ],
  [
    "chatgpt-compatible-search",
    {
      id: "chatgpt-compatible-search",
      title: "ChatGPT-Compatible MCP Search Stub",
      text:
        "The search and fetch tools follow the simple ChatGPT-compatible shape: search returns result IDs and fetch returns full text with a URL.",
      url: "https://example.invalid/mcp-probe/chatgpt",
      metadata: { source: "mcp-probe", client: "chatgpt" },
    },
  ],
])

const resources = [
  {
    uri: "probe://server/overview",
    name: "overview",
    title: "MCP Probe Overview",
    description: "Short overview resource exposed by the probe server.",
    mimeType: "text/markdown",
    annotations: { audience: ["user", "assistant"], priority: 0.8 },
  },
  {
    uri: "probe://server/client-observation",
    name: "client-observation",
    title: "Client Observation Checklist",
    description: "Checklist for interpreting the probe trace log.",
    mimeType: "text/markdown",
    annotations: { audience: ["assistant"], priority: 0.7 },
  },
]

const resourceContents = new Map([
  [
    "probe://server/overview",
    "# MCP Probe Overview\n\nThis resource is exposed through `resources/list` and `resources/read`. If a client can read it, resource support is present beyond normal tools.",
  ],
  [
    "probe://server/client-observation",
    "# Client Observation Checklist\n\nCheck whether the client called `server/discover`, included `_meta`, declared `clientCapabilities`, requested prompts/resources, and retried `input_required` results.",
  ],
])

const prompts = [
  {
    name: "probe_summary",
    title: "Summarize Probe Trace",
    description: "Prompt template that asks the model to summarize observed MCP client behavior.",
    arguments: [
      {
        name: "client",
        description: "Client under test, for example OpenCode or Codex.",
        required: false,
      },
    ],
  },
]

const tools = [
  {
    name: "echo_meta",
    title: "Echo Metadata",
    description:
      "Returns the received arguments and MCP request metadata. Use this first to inspect protocolVersion, clientInfo, and clientCapabilities.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Any message to echo back." },
      },
      additionalProperties: true,
    },
    outputSchema: {
      type: "object",
      properties: {
        arguments: { type: "object" },
        meta: { type: "object" },
        observed: { type: "object" },
      },
      required: ["arguments", "meta", "observed"],
    },
  },
  {
    name: "structured_result",
    title: "Structured Result",
    description: "Returns both text content and structuredContent conforming to outputSchema.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Optional label for the generated result." },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        label: { type: "string" },
        answer: { type: "number" },
        nested: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
      },
      required: ["label", "answer", "nested"],
    },
  },
  {
    name: "create_handle",
    title: "Create Handle",
    description: "Creates an explicit short-lived probe handle to test stateless multi-call tool design.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Target system or scenario for the handle." },
      },
      required: ["target"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        handle: { type: "string" },
        target: { type: "string" },
        expiresInSeconds: { type: "integer" },
      },
      required: ["handle", "target", "expiresInSeconds"],
    },
  },
  {
    name: "use_handle",
    title: "Use Handle",
    description: "Uses a handle returned by create_handle. Unknown handles return a tool execution error.",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string", description: "Handle returned by create_handle." },
        query: { type: "string", description: "Probe query to associate with the handle." },
      },
      required: ["handle", "query"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        handle: { type: "string" },
        target: { type: "string" },
        query: { type: "string" },
        callCount: { type: "integer" },
      },
      required: ["handle", "target", "query", "callCount"],
    },
  },
  {
    name: "needs_form_input",
    title: "Needs Form Input",
    description:
      "Returns resultType input_required until the client retries with inputResponses. This tests MRTR and elicitation form mode.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic for the requested follow-up input." },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    name: "tool_error",
    title: "Tool Error",
    description: "Always returns a tool execution error via isError true, not a JSON-RPC protocol error.",
    inputSchema: { type: "object", additionalProperties: false },
  },
  {
    name: "resource_link_result",
    title: "Resource Link Result",
    description: "Returns a resource_link content item pointing at a probe resource.",
    inputSchema: { type: "object", additionalProperties: false },
  },
  {
    name: "search",
    title: "Search Probe Documents",
    description:
      "ChatGPT-compatible read-only search stub. Returns result IDs, titles, and URLs. Use fetch to retrieve full text.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              url: { type: "string" },
            },
            required: ["id", "title", "url"],
          },
        },
      },
      required: ["results"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "fetch",
    title: "Fetch Probe Document",
    description: "ChatGPT-compatible read-only fetch stub. Retrieves full text for an ID returned by search.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Document ID returned by search." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        text: { type: "string" },
        url: { type: "string" },
        metadata: { type: "object" },
      },
      required: ["id", "title", "text", "url"],
    },
    annotations: { readOnlyHint: true },
  },
]

export function trace(direction, payload) {
  const entry = {
    ts: new Date().toISOString(),
    pid: process.pid,
    direction,
    payload,
  }

  try {
    appendFileSync(TRACE_PATH, `${JSON.stringify(entry)}\n`, "utf8")
  } catch (error) {
    process.stderr.write(`mcp-probe trace failed: ${error.message}\n`)
  }
}

export async function handleJsonRpc(request, transport = {}) {
  if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return errorResponse(request?.id ?? null, -32600, "Invalid Request")
  }

  const isNotification = request.id === undefined

  try {
    const result = await dispatch(request, transport)
    if (isNotification) return null
    return { jsonrpc: "2.0", id: request.id, result }
  } catch (error) {
    if (isNotification) return null

    if (error && typeof error.code === "number") {
      return errorResponse(request.id ?? null, error.code, error.message, error.data)
    }

    return errorResponse(request.id ?? null, -32603, error?.message || "Internal error")
  }
}

async function dispatch(request, transport) {
  const params = request.params || {}

  switch (request.method) {
    case "server/discover":
      return complete({
        supportedVersions: [PROTOCOL_VERSION, "2025-11-25", "2025-06-18"],
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: true, subscribe: false },
          prompts: { listChanged: true },
        },
        _meta: {
          "io.modelcontextprotocol/serverInfo": SERVER_INFO,
        },
        instructions:
          "mcp-probe is a diagnostic server. Start with echo_meta, then structured_result, create_handle/use_handle, needs_form_input, resources, prompts, search and fetch.",
        ttlMs: 60000,
        cacheScope: "public",
      })

    case "initialize":
      return {
        protocolVersion: chooseInitializeProtocolVersion(params.protocolVersion),
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: true, subscribe: false },
          prompts: { listChanged: true },
        },
        serverInfo: SERVER_INFO,
        instructions:
          "mcp-probe is a diagnostic server. This initialize response is provided for legacy clients.",
      }

    case "notifications/initialized":
    case "notifications/cancelled":
      return {}

    case "tools/list":
      return complete({ tools, ttlMs: 300000, cacheScope: "public" })

    case "tools/call":
      return callTool(params, request, transport)

    case "resources/list":
      return complete({ resources, ttlMs: 300000, cacheScope: "public" })

    case "resources/read":
      return readResource(params)

    case "resources/templates/list":
      return complete({
        resourceTemplates: [
          {
            uriTemplate: "probe://docs/{id}",
            name: "probe-doc",
            title: "Probe Document By ID",
            description: "Template for probe documents also exposed through search/fetch.",
            mimeType: "text/plain",
          },
        ],
        ttlMs: 300000,
        cacheScope: "public",
      })

    case "prompts/list":
      return complete({ prompts, ttlMs: 300000, cacheScope: "public" })

    case "prompts/get":
      return getPrompt(params)

    case "subscriptions/listen":
      return complete({
        _meta: { "io.modelcontextprotocol/subscriptionId": request.id },
        message: "mcp-probe acknowledges subscriptions but does not emit live updates in stdio MVP.",
      })

    default:
      throw rpcError(-32601, `Method not found: ${request.method}`)
  }
}

function callTool(params, request, transport) {
  const name = params.name
  const args = params.arguments || {}

  switch (name) {
    case "echo_meta": {
      const meta = params._meta || {}
      const clientCapabilities = meta["io.modelcontextprotocol/clientCapabilities"] || {}
      const structuredContent = {
        arguments: args,
        meta,
        transport,
        observed: {
          hasProtocolVersion: Boolean(meta["io.modelcontextprotocol/protocolVersion"]),
          protocolVersion: meta["io.modelcontextprotocol/protocolVersion"] || null,
          hasClientInfo: Boolean(meta["io.modelcontextprotocol/clientInfo"]),
          clientInfo: meta["io.modelcontextprotocol/clientInfo"] || null,
          hasClientCapabilities: Boolean(meta["io.modelcontextprotocol/clientCapabilities"]),
          clientCapabilities,
          declaresElicitation: Boolean(clientCapabilities.elicitation),
          transportHasHeaders: Boolean(transport.headers),
        },
      }
      return toolResult(structuredContent, "Received MCP metadata:\n" + JSON.stringify(structuredContent, null, 2))
    }

    case "structured_result": {
      const structuredContent = {
        label: args.label || "probe",
        answer: 42,
        nested: { ok: true },
      }
      return toolResult(structuredContent, `Structured result for ${structuredContent.label}: answer=${structuredContent.answer}`)
    }

    case "create_handle": {
      const target = requireString(args.target, "target")
      const handle = `probe_${cryptoRandomId()}`
      handles.set(handle, { target, callCount: 0, createdAt: Date.now() })
      const structuredContent = { handle, target, expiresInSeconds: 3600 }
      return toolResult(structuredContent, `Created handle ${handle} for target ${target}.`)
    }

    case "use_handle": {
      const handle = requireString(args.handle, "handle")
      const query = requireString(args.query, "query")
      const state = handles.get(handle)
      if (!state) {
        return {
          resultType: "complete",
          isError: true,
          content: [{ type: "text", text: `Unknown or expired handle: ${handle}` }],
        }
      }
      state.callCount += 1
      const structuredContent = { handle, target: state.target, query, callCount: state.callCount }
      return toolResult(structuredContent, `Handle ${handle} used for ${state.target}: ${query}`)
    }

    case "needs_form_input": {
      const topic = requireString(args.topic, "topic")
      const response = params.inputResponses?.probe_extra_details
      if (!response) {
        return {
          resultType: "input_required",
          inputRequests: {
            probe_extra_details: {
              method: "elicitation/create",
              params: {
                mode: "form",
                message: `Please provide one extra detail for ${topic}.`,
                requestedSchema: {
                  type: "object",
                  properties: {
                    detail: {
                      type: "string",
                      title: "Extra Detail",
                      description: "Short additional detail used to complete the probe call.",
                      default: "client supplied detail",
                    },
                    confirmed: {
                      type: "boolean",
                      title: "Confirmed",
                      default: true,
                    },
                  },
                  required: ["detail"],
                },
              },
            },
          },
          requestState: Buffer.from(JSON.stringify({ topic, createdAt: Date.now() }), "utf8").toString("base64url"),
        }
      }

      const structuredContent = {
        topic,
        action: response.action,
        content: response.content || null,
        requestState: params.requestState || null,
      }
      return toolResult(structuredContent, "MRTR completed:\n" + JSON.stringify(structuredContent, null, 2))
    }

    case "tool_error":
      return {
        resultType: "complete",
        isError: true,
        content: [
          {
            type: "text",
            text: "Intentional probe tool error. This is a tool execution error, not a JSON-RPC protocol error.",
          },
        ],
      }

    case "resource_link_result":
      return {
        resultType: "complete",
        isError: false,
        content: [
          {
            type: "resource_link",
            uri: "probe://server/overview",
            name: "overview",
            description: "Probe overview resource.",
            mimeType: "text/markdown",
          },
        ],
      }

    case "search": {
      const query = requireString(args.query, "query").toLowerCase()
      const results = [...docs.values()]
        .filter((doc) => `${doc.title} ${doc.text}`.toLowerCase().includes(query) || query.length > 0)
        .map(({ id, title, url }) => ({ id, title, url }))
      const structuredContent = { results }
      return toolResult(structuredContent, JSON.stringify(structuredContent))
    }

    case "fetch": {
      const id = requireString(args.id, "id")
      const doc = docs.get(id)
      if (!doc) throw rpcError(-32602, `Unknown document id: ${id}`, { id })
      return toolResult(doc, JSON.stringify(doc))
    }

    default:
      throw rpcError(-32602, `Unknown tool: ${name}`)
  }
}

function readResource(params) {
  const uri = requireString(params.uri, "uri")
  if (uri.startsWith("probe://docs/")) {
    const id = uri.slice("probe://docs/".length)
    const doc = docs.get(id)
    if (!doc) throw rpcError(-32602, "Resource not found", { uri })
    return complete({
      contents: [{ uri, mimeType: "text/plain", text: doc.text }],
      ttlMs: 60000,
      cacheScope: "public",
    })
  }

  const text = resourceContents.get(uri)
  if (!text) throw rpcError(-32602, "Resource not found", { uri })

  return complete({
    contents: [{ uri, mimeType: "text/markdown", text }],
    ttlMs: 60000,
    cacheScope: "public",
  })
}

function getPrompt(params) {
  const name = requireString(params.name, "name")
  if (name !== "probe_summary") throw rpcError(-32602, `Unknown prompt: ${name}`)

  const client = params.arguments?.client || "the MCP client"
  return complete({
    description: "Summarize observed MCP client behavior from the probe trace.",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Summarize what ${client} appears to support based on the mcp-probe trace. Focus on discovery, _meta, tools, resources, prompts, structuredContent, and input_required handling.`,
        },
      },
    ],
  })
}

function complete(result) {
  return { resultType: "complete", ...result }
}

function toolResult(structuredContent, text) {
  return {
    resultType: "complete",
    isError: false,
    content: [{ type: "text", text }],
    structuredContent,
  }
}

function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw rpcError(-32602, `Missing or invalid string parameter: ${name}`, { parameter: name })
  }
  return value
}

function errorResponse(id, code, message, data) {
  const error = { code, message }
  if (data !== undefined) error.data = data
  return { jsonrpc: "2.0", id, error }
}

function rpcError(code, message, data) {
  const error = new Error(message)
  error.code = code
  error.data = data
  return error
}

function chooseInitializeProtocolVersion(requested) {
  if (["2025-11-25", "2025-06-18"].includes(requested)) return requested
  return "2025-11-25"
}

function cryptoRandomId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
