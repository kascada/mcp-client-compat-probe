#!/usr/bin/env node
import readline from "node:readline"
import { handleJsonRpc, trace } from "./probe-core.mjs"

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})

process.stderr.write("mcp-probe stdio server started\n")

rl.on("line", async (line) => {
  if (!line.trim()) return

  let request
  try {
    request = JSON.parse(line)
  } catch (error) {
    const response = {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: `Parse error: ${error.message}` },
    }
    trace("out", response)
    process.stdout.write(`${JSON.stringify(response)}\n`)
    return
  }

  trace("in", request)

  const response = await handleJsonRpc(request, { type: "stdio" })
  if (!response) return

  trace("out", response)
  process.stdout.write(`${JSON.stringify(response)}\n`)
})

rl.on("close", () => {
  process.stderr.write("mcp-probe stdio server stopped\n")
})
