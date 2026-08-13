# MCP Client Support Matrix

Status: 2026-08-13

This is an informal, evidence-oriented matrix for MCP client behavior. It combines public documentation with local observations from `mcp-probe` where available. It is not a formal MCP conformance test.

## Legend

| Marker | Meaning |
|---|---|
| `yes-docs` | Publicly documented support |
| `partial-docs` | Publicly documented as partial, indirect, limited, or surface-specific |
| `no-docs` | Publicly documented as unsupported or not applicable |
| `unknown` | No reliable public information found |
| `server-docs` | Documented as an MCP server, not as a client capability of the assistant |
| `yes-probe` | Positively observed locally with `mcp-probe` |
| `partial-probe` | Partly observed locally with `mcp-probe`: the protocol side works but something around it does not, see the linked result file |
| `no-probe` | Tested locally with `mcp-probe` and not observed |

## Matrix

| MCP feature | OpenCode | Claude Code | Perplexity | OpenAI / ChatGPT / Codex | GitHub Copilot / VS Code | Gemini CLI | Cursor |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tools (`tools/list`, `tools/call`) | yes-probe | yes-probe | server-docs | yes-docs | yes-docs | yes-docs | partial-docs |
| Resources | yes-probe | yes-probe | unknown | partial-docs | yes-docs | yes-docs | unknown |
| Prompts | yes-probe | yes-probe | unknown | unknown | yes-docs | yes-docs | unknown |
| Local `stdio` servers | yes-probe | yes-probe | server-docs | yes-docs | yes-docs | yes-docs | partial-docs |
| Remote Streamable HTTP | yes-docs | yes-docs | server-docs | yes-docs | yes-docs | yes-docs | yes-docs |
| Deprecated HTTP+SSE / SSE | unknown | yes-docs | unknown | partial-docs | unknown | yes-docs | unknown |
| Bearer header / static headers | yes-docs | yes-docs | server-docs | yes-docs | yes-docs | yes-docs | yes-docs |
| OAuth for remote MCP | yes-docs | yes-docs | no-docs | yes-docs | partial-docs | yes-docs | unknown |
| CIMD instead of Dynamic Client Registration | unknown | yes-docs | unknown | yes-docs | unknown | unknown | unknown |
| Exact statelessness of MCP `2026-07-28` | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| `server/discover` | no-probe | yes-probe | unknown | unknown | unknown | unknown | unknown |
| Per-request `_meta` with protocol version and capabilities | no-probe | yes-probe | unknown | unknown | unknown | unknown | unknown |
| HTTP metadata headers: `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| `x-mcp-header` from tool parameters | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| `resultType`, MRTR and `input_required` | unknown | yes-probe | unknown | partial-docs | unknown | unknown | unknown |
| Elicitation Form Mode | unknown | partial-probe | unknown | partial-docs | unknown | unknown | unknown |
| Elicitation URL Mode | unknown | yes-docs | unknown | unknown | unknown | unknown | unknown |
| `subscriptions/listen` and list-changed invalidation | unknown | partial-probe | unknown | unknown | unknown | unknown | unknown |
| `ttlMs` and `cacheScope` | unknown | partial-docs | unknown | unknown | unknown | unknown | unknown |
| JSON Schema 2020-12, `outputSchema`, `structuredContent` | yes-probe | yes-probe | server-docs | yes-docs | unknown | partial-docs | unknown |
| Official Tasks extension `io.modelcontextprotocol/tasks` | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| Roots, Sampling and Logging treated as deprecated | unknown | partial-docs | unknown | unknown | unknown | unknown | unknown |
| MCP Apps extension | unknown | unknown | unknown | yes-docs | yes-docs | unknown | yes-docs |

## OpenCode Probe Result

Local test setup:

- Client: OpenCode `1.18.18`
- Transport: local `stdio`
- Probe server: this repository's `stdio-server.mjs`
- Trace: `/tmp/mcp-probe-opencode.ndjson`

Observed:

- OpenCode started the local `stdio` server.
- OpenCode used the legacy `initialize` handshake with `protocolVersion: "2025-11-25"`.
- OpenCode sent `notifications/initialized`.
- OpenCode called `tools/list`, `resources/list`, `prompts/list`, and `prompts/get`.
- OpenCode successfully called `tools/call` for `echo_meta`.
- During `tools/call`, `_meta` contained `progressToken`, but not `io.modelcontextprotocol/protocolVersion` or `io.modelcontextprotocol/clientCapabilities`.
- `server/discover` was not observed.

Interpretation:

- OpenCode support for tools, resources, prompts, and local `stdio` is positively observed.
- The OpenCode test did not observe modern MCP `2026-07-28` discovery or per-request metadata negotiation.
- This does not rule out different behavior for other OpenCode versions, remote MCP transports, or future releases.

## Claude Code Probe Result

Local test setup:

- Client: Claude Code `2.1.231`
- OS: Ubuntu 22.04.5 LTS on WSL2
- Transport: local `stdio`
- Probe server: this repository's `stdio-server.mjs` at commit `f0cb698`
- Trace: `/tmp/mcp-probe-claude-code.ndjson`
- Full result: [`results/claude-code-kascada-2026-08-13.md`](results/claude-code-kascada-2026-08-13.md)

Observed:

- Claude Code started the local `stdio` server.
- Claude Code used `server/discover` and negotiated `2026-07-28`, the highest version the probe offers. No `initialize` fallback appeared anywhere in the trace.
- Every request carried `_meta` with `io.modelcontextprotocol/protocolVersion`, `clientInfo` and `clientCapabilities`. Tool calls additionally carried the vendor-specific `claudecode/toolUseId` and a `progressToken`.
- Declared client capabilities were `{roots: {listChanged: true}, elicitation: {}}`. Elicitation is declared, but as an empty object naming no modes.
- Claude Code called `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get` and `subscriptions/listen`.
- `structuredContent` was consumed directly rather than via the text fallback, and an explicit handle survived across two separate tool calls.
- A tool result with `isError: true` was surfaced as an ordinary tool failure, not as a protocol error, and the session continued.
- `input_required` was retried correctly with `inputResponses` and `requestState`.

Interpretation:

- Claude Code positively demonstrates the `2026-07-28` surface the probe can reach over `stdio`: modern discovery, per-request metadata, the full tool/resource/prompt set, and the MRTR round trip.
- Elicitation is `partial-probe` rather than `yes-probe` because no form was ever shown. The retry happened inside the client's MCP layer, invisible to both user and assistant: the first attempt and the retry share the same `claudecode/toolUseId`, and the values returned were exactly the `default` values from the server's `requestedSchema`. Both schema fields had defaults, so the case of a required field without a default remains untested.
- `subscriptions/listen` is `partial-probe` because the call itself is observed, but the probe emits no live updates over `stdio`, so actual list-changed invalidation was never exercised.
- Prompts work, but `prompts/get` is reachable only through a user-typed slash command. Claude Code gives the assistant dedicated tools for MCP resources and no equivalent for prompts.
- Everything HTTP-specific in this matrix stays untested here: headers, OAuth, CIMD, Streamable HTTP and `x-mcp-header` are out of reach over `stdio`.
- This reflects one version on one machine and does not rule out different behavior in other Claude Code releases or over remote transports.

## Main Sources

- MCP specification, changelog, deprecated features, Streamable HTTP, Elicitation, Tasks and Caching: <https://modelcontextprotocol.io/>
- OpenCode MCP documentation: <https://opencode.ai/docs/mcp-servers/>
- Claude Code MCP documentation: <https://code.claude.com/docs/en/mcp.md>
- Perplexity MCP server documentation: <https://docs.perplexity.ai/guides/mcp-server>
- OpenAI/Codex MCP documentation: <https://developers.openai.com/codex/extend/mcp> and <https://platform.openai.com/docs/mcp>
- VS Code and GitHub Copilot MCP documentation: <https://code.visualstudio.com/docs/copilot/chat/mcp-servers> and <https://docs.github.com/>
- Gemini CLI MCP documentation: <https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md>
- MCP Extension Matrix: <https://modelcontextprotocol.io/extensions/client-matrix>
