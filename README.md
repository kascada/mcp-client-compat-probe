# MCP Client Compatibility Probe

Small diagnostic MCP server for checking what MCP clients actually support.

The server is intentionally dependency-free and split into transport-neutral core logic plus a local `stdio` adapter. A future HTTP adapter can reuse `probe-core.mjs` for ChatGPT Web, OpenAI API, or remote MCP testing.

The intended workflow is AI-assisted: clone the repo, open it in the assistant/client you want to test, paste [`PROMPT.md`](PROMPT.md), and let the assistant run the probe, inspect the trace, create a result file, and prepare a commit.

Detailed test design and result templates live in [`TESTPLAN.md`](TESTPLAN.md).

## Quick Start For Testers

Human steps:

1. Clone this repository.

   ```bash
   git clone https://github.com/kascada/mcp-client-compat-probe.git
   cd mcp-client-compat-probe
   ```

   HTTPS is recommended for most testers because it works without a configured SSH key. If you already use GitHub over SSH, this is equivalent:

   ```bash
   git clone git@github.com:kascada/mcp-client-compat-probe.git
   cd mcp-client-compat-probe
   ```

2. Open the cloned directory in the MCP-capable assistant/client you want to test.
3. Paste the full content of [`PROMPT.md`](PROMPT.md) into that assistant.
4. Follow only the explicit prompts for client restart, MCP setup confirmation, and push/PR approval.

The assistant should handle the rest:

- run `npm run smoke`
- help configure the local `stdio` MCP server if needed
- run the probe interactions
- inspect the trace file
- write `results/<client>-<username>-<date>.md`
- stage and commit only that result file

Do not commit full trace files by default. Result files should include only small redacted excerpts.

## Files

```text
mcp-probe/
  README.md              # quickstart and feature overview
  PROMPT.md              # assistant prompt for running and recording tests
  TESTPLAN.md            # repeatable client test plan
  probe-core.mjs          # JSON-RPC handlers and probe tools
  stdio-server.mjs        # local stdio transport
  opencode.json           # isolated OpenCode test config
  package.json            # npm scripts, no dependencies
  results/                # contributed client observations
  scripts/smoke-stdio.mjs # direct stdio smoke test
```

## Probe Coverage

Implemented MCP methods:

- `server/discover`
- legacy `initialize` fallback response
- `tools/list`
- `tools/call`
- `resources/list`
- `resources/read`
- `resources/templates/list`
- `prompts/list`
- `prompts/get`
- stub `subscriptions/listen`

Tools:

- `echo_meta`: returns received arguments, `_meta`, client capabilities, and transport observations.
- `structured_result`: returns text plus `structuredContent` matching an `outputSchema`.
- `create_handle`: creates an explicit state handle.
- `use_handle`: uses a handle from `create_handle`.
- `needs_form_input`: returns `resultType: "input_required"` until retried with `inputResponses`.
- `tool_error`: returns a tool execution error via `isError: true`.
- `resource_link_result`: returns a `resource_link` content item.
- `search`: ChatGPT-compatible search stub.
- `fetch`: ChatGPT-compatible fetch stub.

## Smoke Test

Run from this directory:

```bash
npm run smoke
```

Or without npm:

```bash
node scripts/smoke-stdio.mjs
```

The smoke test writes its trace to:

```text
/tmp/mcp-probe-smoke.ndjson
```

## Trace Log

The server never writes diagnostics to stdout, because stdout must contain only MCP JSON-RPC messages. Diagnostics go to stderr and the trace file.

Default trace path:

```text
/tmp/mcp-probe.ndjson
```

OpenCode trace path from `opencode.json`:

```text
/tmp/mcp-probe-opencode.ndjson
```

Each line is JSON with:

- `ts`: timestamp
- `pid`: server process ID
- `direction`: `in` or `out`
- `payload`: JSON-RPC payload

## Test With OpenCode

This directory contains an isolated `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "probe": {
      "type": "local",
      "command": ["node", "stdio-server.mjs"],
      "cwd": ".",
      "enabled": true,
      "timeout": 10000,
      "environment": {
        "MCP_PROBE_TRACE": "/tmp/mcp-probe-opencode.ndjson"
      }
    }
  }
}
```

Start OpenCode from this directory so it loads the local config:

```bash
opencode
```

Then ask:

```text
Nutze das probe echo_meta Tool und zeige mir, welche MCP-Metadaten du gesendet hast.
```

Additional useful prompts:

```text
Nutze probe structured_result mit label opencode.
```

```text
Erzeuge mit probe create_handle ein Handle fuer confluence und nutze es danach mit probe use_handle fuer die Query release notes.
```

```text
Teste probe needs_form_input fuer topic OpenCode Elicitation.
```

```text
Nutze probe search fuer query probe und danach probe fetch fuer das erste Ergebnis.
```

Interpret the trace:

- `server/discover` present: modern MCP discovery probe is used.
- `initialize` present: legacy handshake path is used.
- `_meta.io.modelcontextprotocol/protocolVersion` present: per-request protocol version is sent.
- `_meta.io.modelcontextprotocol/clientCapabilities.elicitation` present: client declares elicitation support.
- `resources/list` or `prompts/list` present: client actively queries non-tool primitives.
- Retry after `input_required`: MRTR/Elicitation flow is handled.

OpenCode reads config at startup. Restart OpenCode after changing `opencode.json` or server files.

## Test With Codex CLI Or ChatGPT Desktop

The same local `stdio` server can be used by Codex CLI, ChatGPT Desktop app, and Codex IDE extension because they support local MCP servers.

Example Codex CLI registration from this directory:

```bash
codex mcp add probe --env MCP_PROBE_TRACE=/tmp/mcp-probe-codex.ndjson -- node stdio-server.mjs
```

Then use `/mcp` in Codex to inspect active servers and ask for the same probe tools as above.

For ChatGPT Desktop app, add a new MCP server in Settings with:

- Name: `probe`
- Type: `STDIO`
- Command: `node`
- Args: absolute path to `stdio-server.mjs`
- Environment: `MCP_PROBE_TRACE=/tmp/mcp-probe-chatgpt-desktop.ndjson`

## ChatGPT Web And OpenAI API Path

ChatGPT Web cannot directly start a local `stdio` server or read local Codex/OpenCode configuration. For ChatGPT Web or OpenAI API testing, add a remote HTTP adapter later.

The current design keeps that path open:

- `probe-core.mjs` has no stdio-specific behavior.
- `stdio-server.mjs` only adapts newline-delimited JSON-RPC to `handleJsonRpc`.
- A future `http-server.mjs` can call the same `handleJsonRpc` and pass HTTP headers in the transport object.
- The existing `search` and `fetch` tools already follow the simple ChatGPT-compatible shape with `structuredContent` and URL-backed results.

HTTP-specific checks to add later:

- `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`
- static/Bearer headers
- OAuth behavior
- `x-mcp-header` from tool parameters
- Streamable HTTP response behavior
