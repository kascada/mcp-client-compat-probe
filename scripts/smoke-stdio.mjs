#!/usr/bin/env node
import { spawn } from "node:child_process"
import readline from "node:readline"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const serverPath = resolve(root, "stdio-server.mjs")

const child = spawn(process.execPath, [serverPath], {
  cwd: root,
  env: {
    ...process.env,
    MCP_PROBE_TRACE: "/tmp/mcp-probe-smoke.ndjson",
  },
  stdio: ["pipe", "pipe", "pipe"],
})

const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity })
const pending = new Map()
let nextId = 1

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk)
})

rl.on("line", (line) => {
  const message = JSON.parse(line)
  const waiter = pending.get(message.id)
  if (!waiter) return
  pending.delete(message.id)
  waiter(message)
})

function request(method, params = {}) {
  const id = nextId++
  const message = { jsonrpc: "2.0", id, method, params }
  child.stdin.write(`${JSON.stringify(message)}\n`)

  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Timeout waiting for ${method}`))
    }, 3000)

    pending.set(id, (response) => {
      clearTimeout(timeout)
      if (response.error) reject(new Error(`${method}: ${response.error.message}`))
      else resolvePromise(response.result)
    })
  })
}

function meta(extraCapabilities = {}) {
  return {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { name: "mcp-probe-smoke", version: "0.1.0" },
      "io.modelcontextprotocol/clientCapabilities": extraCapabilities,
    },
  }
}

try {
  const discover = await request("server/discover", meta({ elicitation: { form: {} } }))
  assert(discover.resultType === "complete", "server/discover resultType")
  assert(discover.capabilities.tools, "server/discover tools capability")

  const listedTools = await request("tools/list", meta())
  assert(listedTools.tools.some((tool) => tool.name === "echo_meta"), "tools/list includes echo_meta")
  assert(listedTools.tools.some((tool) => tool.name === "search"), "tools/list includes search")

  const echo = await request("tools/call", {
    name: "echo_meta",
    arguments: { message: "hello" },
    ...meta({ elicitation: { form: {}, url: {} } }),
  })
  assert(echo.structuredContent.observed.hasProtocolVersion, "echo_meta observes protocol version")
  assert(echo.structuredContent.observed.declaresElicitation, "echo_meta observes elicitation")

  const structured = await request("tools/call", {
    name: "structured_result",
    arguments: { label: "smoke" },
    ...meta(),
  })
  assert(structured.structuredContent.answer === 42, "structured_result answer")

  const createHandle = await request("tools/call", {
    name: "create_handle",
    arguments: { target: "smoke" },
    ...meta(),
  })
  const useHandle = await request("tools/call", {
    name: "use_handle",
    arguments: { handle: createHandle.structuredContent.handle, query: "ping" },
    ...meta(),
  })
  assert(useHandle.structuredContent.callCount === 1, "use_handle call count")

  const inputRequired = await request("tools/call", {
    name: "needs_form_input",
    arguments: { topic: "smoke" },
    ...meta({ elicitation: { form: {} } }),
  })
  assert(inputRequired.resultType === "input_required", "needs_form_input asks for input")

  const completedInput = await request("tools/call", {
    name: "needs_form_input",
    arguments: { topic: "smoke" },
    inputResponses: {
      probe_extra_details: {
        action: "accept",
        content: { detail: "smoke detail", confirmed: true },
      },
    },
    requestState: inputRequired.requestState,
    ...meta({ elicitation: { form: {} } }),
  })
  assert(completedInput.resultType === "complete", "needs_form_input completes after retry")

  const listedResources = await request("resources/list", meta())
  assert(listedResources.resources.length > 0, "resources/list returns resources")
  const readResource = await request("resources/read", { uri: "probe://server/overview", ...meta() })
  assert(readResource.contents[0].text.includes("MCP Probe Overview"), "resources/read returns overview")

  const listedPrompts = await request("prompts/list", meta())
  assert(listedPrompts.prompts.some((prompt) => prompt.name === "probe_summary"), "prompts/list includes probe_summary")

  const search = await request("tools/call", {
    name: "search",
    arguments: { query: "probe" },
    ...meta(),
  })
  assert(search.structuredContent.results.length > 0, "search returns results")

  const fetch = await request("tools/call", {
    name: "fetch",
    arguments: { id: search.structuredContent.results[0].id },
    ...meta(),
  })
  assert(fetch.structuredContent.text.length > 0, "fetch returns text")

  console.log("mcp-probe stdio smoke test passed")
} finally {
  child.stdin.end()
  child.kill("SIGTERM")
}

function assert(condition, label) {
  if (!condition) throw new Error(`Assertion failed: ${label}`)
}
