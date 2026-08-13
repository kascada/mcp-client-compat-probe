# MCP Probe Testplan

This document describes how to run repeatable MCP client tests with `mcp-probe` and how to record results.

The goal is not formal MCP certification. The goal is to replace public-documentation guesses with observed client behavior.

## Scope

`mcp-probe` is a small diagnostic MCP server. It exposes tools, resources, prompts, structured results, explicit handles, and an MRTR/Elicitation test tool. It logs every JSON-RPC message so the test result can be inspected independently of the assistant's final answer.

The reference point is the MCP revision `2026-07-28`. The probe answers `supportedVersions: ["2026-07-28", "2025-11-25", "2025-06-18"]`, so a client can negotiate down. Most of what the probe measures is what that revision added: `server/discover` in place of `initialize`, per-request `_meta.io.modelcontextprotocol/*`, `resultType` on every response, `input_required` with `inputResponses` and `requestState`, and `subscriptions/listen`. Older features such as `structuredContent`, `outputSchema` and `isError` are included so a client that handles the established surface well but has not moved to the new revision is visibly distinguishable from one that has.

Current transport:

- Local `stdio`

Planned transport:

- Streamable HTTP for ChatGPT Web, OpenAI API, remote clients, and HTTP-header tests

## Repository Contents

```text
mcp-probe/
  README.md              # quick usage notes
  TESTPLAN.md            # this file
  package.json           # no dependencies; scripts only
  opencode.json          # isolated OpenCode config
  probe-core.mjs         # transport-neutral JSON-RPC handlers
  stdio-server.mjs       # stdio adapter
  scripts/smoke-stdio.mjs
```

## What The Probe Can Observe

Positive observations:

- Client can start a local `stdio` MCP server.
- Client performs legacy `initialize` or modern `server/discover`.
- Client calls `tools/list`.
- Client calls `tools/call`.
- Client calls `resources/list` and `resources/read`.
- Client calls `prompts/list` and `prompts/get`.
- Client can display or use `structuredContent` and `outputSchema` results.
- Client can pass explicit handles across tool calls.
- Client can handle tool execution errors with `isError: true`.
- Client can handle `resultType: "input_required"` and retry with `inputResponses`.

Negative or missing observations:

- No `server/discover` request observed.
- No per-request `_meta.io.modelcontextprotocol/protocolVersion` observed.
- No per-request `_meta.io.modelcontextprotocol/clientCapabilities` observed.
- No elicitation capability declared.
- No retry after `input_required`.
- Resources or prompts are listed but not actually usable by the assistant UI.

Not covered by the current `stdio` transport:

- `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` HTTP headers
- Bearer/static HTTP headers as actually sent on the wire
- OAuth flows
- `x-mcp-header` from tool parameters
- Streamable HTTP behavior

## Run The Local Smoke Test

From the `mcp-probe` directory:

```bash
npm run smoke
```

Expected output:

```text
mcp-probe stdio smoke test passed
```

Trace file:

```text
/tmp/mcp-probe-smoke.ndjson
```

## Trace Files

Set `MCP_PROBE_TRACE` to choose the trace file.

Each trace line is JSON:

```json
{
  "ts": "2026-08-13T09:20:28.346Z",
  "pid": 254836,
  "direction": "in",
  "payload": {
    "method": "initialize"
  }
}
```

Important rule: stdout must contain only MCP JSON-RPC messages. Human-readable diagnostics go to stderr and the trace file.

## Standard Test Prompts

Use these prompts, adjusted only for the client's MCP tool naming convention.

### T1 Metadata

```text
Use the probe echo_meta tool and show the MCP metadata you sent.
```

Expected trace signal:

- `tools/call` with `name: "echo_meta"`
- Inspect `params._meta`

Record:

- Protocol version in initialize or discover
- Whether per-request protocol version exists
- Whether client info exists per request
- Whether client capabilities exist per request
- Whether elicitation is declared

### T2 Structured Result

```text
Use probe structured_result with label CLIENT_NAME and summarize the structured result.
```

Expected trace signal:

- `tools/call` with `name: "structured_result"`
- Server response contains `structuredContent.answer: 42`

Record:

- Whether the assistant saw the structured data correctly
- Whether it only used text fallback

### T3 Explicit Handle

```text
Create a probe handle for target confluence and then use that handle for query release notes.
```

Expected trace signal:

- `tools/call create_handle`
- `tools/call use_handle`
- Same handle string appears in the second call

Record:

- Whether the assistant carried the handle across calls

### T4 Tool Error

```text
Call probe tool_error and explain whether it was a tool execution error or a protocol error.
```

Expected trace signal:

- Server response has `result.isError: true`
- No JSON-RPC `error` object

Record:

- Whether the assistant reports this as a normal tool execution error

### T5 Resources

```text
Read the probe overview resource and summarize it in one sentence.
```

Expected trace signal:

- `resources/list`
- Ideally `resources/read` for `probe://server/overview`

Record:

- Whether resource discovery happens automatically
- Whether the user can explicitly invoke/read a resource

### T6 Prompts

```text
Use the probe_summary prompt for client CLIENT_NAME.
```

Expected trace signal:

- `prompts/list`
- `prompts/get` with `name: "probe_summary"`

Record:

- Whether prompt templates appear as commands, slash commands, or assistant-accessible prompts

### T7 MRTR / Elicitation

```text
Test probe needs_form_input for topic CLIENT_NAME elicitation.
```

Expected trace signal:

- First response has `resultType: "input_required"`
- Client prompts the user or otherwise handles the input request
- Retry includes `inputResponses` and `requestState`

Record:

- Whether the client declared elicitation support
- Whether it displayed a form
- Whether it retried correctly
- Whether it failed, ignored the result, or exposed raw JSON

### T8 ChatGPT-Compatible Search/Fetch

```text
Use probe search for query probe and then fetch the first result.
```

Expected trace signal:

- `tools/call search`
- `tools/call fetch`

Record:

- Whether the assistant follows the `search` then `fetch` pattern
- Whether citation-like URLs are preserved

## OpenCode Test

Use the included `opencode.json` and start OpenCode from this directory:

```bash
cd /path/to/mcp-probe
opencode
```

Trace path:

```text
/tmp/mcp-probe-opencode.ndjson
```

Observed baseline from OpenCode `1.18.18`:

- Uses `initialize` with `protocolVersion: "2025-11-25"`.
- Sends `notifications/initialized`.
- Calls `tools/list`, `resources/list`, `prompts/list`, and `prompts/get`.
- Tool call `_meta` contained `progressToken`, not `io.modelcontextprotocol/protocolVersion` or `io.modelcontextprotocol/clientCapabilities`.
- `server/discover` was not observed.
- `echo_meta` executed successfully.

## Claude Code Test

This section is intended for a machine where Claude Code is installed.

Recommended setup:

1. Copy or clone this `mcp-probe` directory to the test machine.
2. Run `npm run smoke` locally first.
3. Add `stdio-server.mjs` as a local MCP server in Claude Code according to the Claude Code MCP documentation.
4. Set `MCP_PROBE_TRACE` to a client-specific trace file, for example `/tmp/mcp-probe-claude-code.ndjson`.
5. Restart Claude Code so it reloads MCP configuration.
6. Run the standard test prompts T1-T8.
7. Save the trace file and fill the result template below.

Suggested Claude Code result file name:

```text
results/claude-code-YYYY-MM-DD.md
```

If you do not have a shared repository, send back:

- The result markdown file
- The trace file, ideally compressed
- Claude Code version
- Operating system
- Exact MCP config snippet with secrets removed

## Result Template

~~~markdown
# MCP Probe Result: CLIENT_NAME

Date: YYYY-MM-DD
Tester: NAME_OR_ALIAS
Client: CLIENT_NAME
Client version: VERSION
OS: OS_NAME_VERSION
Transport: stdio
mcp-probe version or commit: VERSION_OR_COMMIT
Trace file: TRACE_FILENAME

## Configuration

```text
PASTE_REDACTED_MCP_CONFIG
```

## Summary Matrix

The split below is a reading aid for how far a client has moved toward `2026-07-28`, not a formal spec citation. Fill both blocks either way.

### Baseline

| Feature | Result | Evidence |
|---|---:|---|
| Local stdio server starts | ? | |
| highest protocol version negotiated | ? | |

### Target Revision Surface (2026-07-28)

| Feature | Result | Evidence |
|---|---:|---|
| server/discover used | ? | |
| initialize used (legacy path) | ? | |
| per-request protocolVersion in _meta | ? | |
| per-request clientCapabilities in _meta | ? | |
| elicitation capability declared | ? | |
| input_required / MRTR retry | ? | |
| subscriptions/listen used | ? | |

### Established MCP Surface

| Feature | Result | Evidence |
|---|---:|---|
| tools/list | ? | |
| tools/call | ? | |
| resources/list | ? | |
| resources/read | ? | |
| prompts/list | ? | |
| prompts/get | ? | |
| structuredContent usable | ? | |
| explicit handle carried across calls | ? | |
| isError tool result handled | ? | |
| search/fetch pattern | ? | |

## Notes

- 

## Relevant Trace Excerpts

```json
PASTE_SMALL_EXCERPTS_ONLY
```
~~~

Use these result markers:

- `yes`: observed working
- `partial`: partially observed or UI-dependent
- `no`: tested and not observed / failed
- `unknown`: not tested or trace inconclusive

## Sharing The Probe

### Option A: ZIP

Best for quick private transfer to one machine.

Pros:

- Fastest path.
- No repository setup.
- Good when the tester just sends back a trace and a result file.

Cons:

- No version tracking unless the ZIP filename includes a date or commit-like version.
- Harder to merge improvements and results from multiple people.
- Testers may accidentally run different versions.

Suggested ZIP name:

```text
mcp-probe-YYYY-MM-DD.zip
```

Create from the parent directory:

```bash
zip -r mcp-probe-YYYY-MM-DD.zip mcp-probe -x 'mcp-probe/node_modules/*'
```

### Option B: Public Git Repository

Best for multiple testers.

Pros:

- Everyone tests the same commit.
- Issues can collect results.
- Pull requests can add client-specific result files.
- Easy to add HTTP transport later.

Cons:

- Slightly more setup.
- Must avoid committing trace files with secrets or private prompts.

Recommended repository layout if published:

```text
mcp-probe/
  README.md
  TESTPLAN.md
  package.json
  probe-core.mjs
  stdio-server.mjs
  scripts/
  results/
    README.md
    opencode-2026-08-13.md
    claude-code-YYYY-MM-DD.md
```

Recommended workflow:

1. Tester clones the repo. A clone is not a fork and carries no write access; the repository being public grants read access only.
2. Tester runs `npm run smoke`.
3. Tester runs the client-specific test.
4. Tester adds a result file under `results/`, named with their GitHub account so the result is attributable.
5. Tester contributes it by the first route available: pull request from their own fork (`gh repo fork --remote`), otherwise an issue with the result file attached, otherwise sending the file to the repository author directly.

Only accounts explicitly added as collaborators can push to this repository. Everyone else contributes through a fork, which needs no permissions here.

### Recommendation

Use Git for anything involving multiple people or repeated tests. Use ZIP only for your immediate private-machine transfer.

For the private-machine transfer, a ZIP is enough. For Claude Code and other external testers, a public Git repo is better because the result can reference an exact commit.
