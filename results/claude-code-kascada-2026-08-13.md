# MCP Probe Result: claude-code

Date: 2026-08-13
Tester: kascada
Client: Claude Code (CLI)
Client version: 2.1.231
OS: Ubuntu 22.04.5 LTS on WSL2 (kernel 5.15.133.1-microsoft-standard-WSL2)
Transport: stdio
mcp-probe version or commit: f0cb698
Trace file: /tmp/mcp-probe-claude-code.ndjson (not committed)

## Configuration

Registered with `claude mcp add` at local scope (stored in `~/.claude.json` under the
project entry, private to this user):

```text
claude mcp add probe --scope local \
  --env MCP_PROBE_TRACE=/tmp/mcp-probe-claude-code.ndjson \
  -- <ABSOLUTE_NODE_PATH> /path/to/mcp-client-compat-probe/stdio-server.mjs
```

Resulting server entry:

```json
{
  "type": "stdio",
  "command": "<ABSOLUTE_NODE_PATH>",
  "args": ["/path/to/mcp-client-compat-probe/stdio-server.mjs"],
  "env": { "MCP_PROBE_TRACE": "/tmp/mcp-probe-claude-code.ndjson" }
}
```

Note: this machine had no `node`/`npm` on `PATH`. An absolute path to a Node v24.18.0
binary was used instead. `npm run smoke` was therefore not runnable; the equivalent
`node scripts/smoke-stdio.mjs` was used and passed both before and after the run.

Claude Code loads MCP configuration at startup only. After `claude mcp add` the running
session did not expose the probe tools; a restart (`claude --continue`) was required.

## Summary Matrix

Trace length at time of evaluation: 44 lines.

### Baseline

| Feature | Result | Evidence |
|---|---:|---|
| Local stdio server starts | yes | server process spawned, trace written; `node scripts/smoke-stdio.mjs` passed |
| highest protocol version negotiated | yes | `2026-07-28`, the highest the probe offers; announced in `_meta` on every request and consistent with the negotiated version |

### Target Revision Surface (2026-07-28)

| Feature | Result | Evidence |
|---|---:|---|
| server/discover used | yes | trace lines 1 and 7, id `server-discover-probe-1` |
| initialize used (legacy path) | no | no `initialize` request anywhere in the trace; no fallback attempted |
| per-request protocolVersion in _meta | yes | `io.modelcontextprotocol/protocolVersion: "2026-07-28"` on every request |
| per-request clientCapabilities in _meta | yes | `{roots:{listChanged:true}, elicitation:{}}` on every request |
| elicitation capability declared | yes | `elicitation: {}` — declared, but empty (no `form`/`url` modes named) |
| input_required / MRTR retry | yes | line 38 `resultType: "input_required"`, line 39 retry with `inputResponses` + `requestState`, line 40 `complete`; no visible form, see Notes |
| subscriptions/listen used | yes | 5 calls (lines 3, 9, 17, 19, 21), requesting `toolsListChanged`, `promptsListChanged`, `resourcesListChanged` |

### Established MCP Surface

| Feature | Result | Evidence |
|---|---:|---|
| tools/list | yes | trace lines 5, 13 |
| tools/call | yes | 9 calls, trace lines 23, 25, 27, 29, 31, 33, 37, 39, 41 |
| resources/list | yes | trace line 12 |
| resources/read | yes | trace line 35, `uri: "probe://server/overview"` |
| prompts/list | yes | trace line 11; response line 14 lists `probe_summary` |
| prompts/get | yes | trace line 43, `name: "probe_summary"`, `arguments: {client: "claude-code"}` — user-typed slash command only, see Notes |
| structuredContent usable | yes | `structured_result` returned `answer: 42`, assistant read the structured object directly |
| explicit handle carried across calls | yes | `probe_msrhtmf7_jgdlf8mt` created line 27, reused line 33, `callCount: 1` |
| isError tool result handled | yes | line 30 `isError: true`, no JSON-RPC `error`; surfaced as a normal tool failure, session continued |
| search/fetch pattern | yes | `search` line 31, `fetch` line 41 with the id from the first search result; URLs preserved |

## Notes

- **Overall: the target revision is fully adopted on the wire.** Claude Code 2.1.231
  negotiates `2026-07-28`, the highest version the probe offers, and exercises every part
  of that surface the probe can reach. The two gaps found are not protocol gaps but
  client-UI gaps: elicitation has no visible form, and prompts are reachable only by the
  user. Nothing in the trace suggests a fallback to an older revision.
- **Modern discovery only.** Claude Code 2.1.231 uses `server/discover` and never falls
  back to `initialize`. It also calls `subscriptions/listen` (5 times in this trace),
  requesting `toolsListChanged`, `promptsListChanged`, `resourcesListChanged`.
- **Per-request metadata is complete.** Every single request carries
  `protocolVersion`, `clientInfo` (name, title, version, description, websiteUrl) and
  `clientCapabilities`. `tools/call` additionally carries the vendor-specific
  `claudecode/toolUseId` and a `progressToken`.
- **Elicitation is declared but has no visible UI.** The `input_required` retry is
  protocol-correct, but it happened entirely inside the client's MCP layer: trace lines
  37 and 39 share the same `claudecode/toolUseId`, and the assistant only ever saw the
  final completed result. No form was shown to the user, and the values sent back were
  exactly the `default` values from the server's `requestedSchema`
  (`detail: "client supplied detail"`, `confirmed: true`) with `action: "accept"`.
  Caveat: both schema fields had defaults, so this run does not show what happens when a
  required field has no default — that case is untested here.
- **Prompts work, but only user-initiated.** `prompts/list` is called at startup and
  `prompts/get` works correctly when the user types the slash command
  `/mcp__probe__probe_summary claude-code` — arguments are passed through
  (`arguments: {client: "claude-code"}`) and the returned message is injected as a user
  turn. The assistant cannot trigger it itself: Claude Code gives the assistant dedicated
  tools for MCP resources (`ListMcpResourcesTool`, `ReadMcpResourceTool`,
  `ReadMcpResourceDirTool`) but no equivalent for prompts. For an autonomous test run
  this is the one step that requires the human.
- **Resources are fully usable.** Both discovery and explicit read work, including
  resource annotations (`audience`, `priority`).
- **Setup friction.** No `node`/`npm` on `PATH` on this machine; an absolute path to an
  editor-bundled Node binary was needed in the MCP command. Such a path is not stable
  across editor updates — a system Node install is preferable for repeat testing.

## Relevant Trace Excerpts

Per-request metadata, identical shape on every request (line 23, truncated):

```json
{
  "method": "tools/call",
  "params": {
    "name": "echo_meta",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "claude-code", "title": "Claude Code", "version": "2.1.231"
      },
      "io.modelcontextprotocol/clientCapabilities": {
        "roots": { "listChanged": true },
        "elicitation": {}
      },
      "claudecode/toolUseId": "toolu_…",
      "progressToken": 3
    }
  }
}
```

MRTR retry — same `toolUseId` as the first attempt, defaults auto-accepted (line 39,
truncated):

```json
{
  "method": "tools/call",
  "params": {
    "name": "needs_form_input",
    "arguments": { "topic": "claude-code elicitation" },
    "inputResponses": {
      "probe_extra_details": {
        "action": "accept",
        "content": { "detail": "client supplied detail", "confirmed": true }
      }
    },
    "requestState": "…",
    "_meta": { "claudecode/toolUseId": "toolu_…", "progressToken": 11 }
  }
}
```

Tool execution error handled as a result, not a protocol error (line 30):

```json
{
  "jsonrpc": "2.0", "id": 6,
  "result": {
    "resultType": "complete",
    "isError": true,
    "content": [{ "type": "text", "text": "Intentional probe tool error. …" }]
  }
}
```
