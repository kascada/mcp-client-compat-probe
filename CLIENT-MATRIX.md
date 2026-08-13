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
| `no-probe` | Tested locally with `mcp-probe` and not observed |

## Matrix

| MCP feature | OpenCode | Claude Code | Perplexity | OpenAI / ChatGPT / Codex | GitHub Copilot / VS Code | Gemini CLI | Cursor |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tools (`tools/list`, `tools/call`) | yes-probe | yes-docs | server-docs | yes-docs | yes-docs | yes-docs | partial-docs |
| Resources | yes-probe | yes-docs | unknown | partial-docs | yes-docs | yes-docs | unknown |
| Prompts | yes-probe | yes-docs | unknown | unknown | yes-docs | yes-docs | unknown |
| Local `stdio` servers | yes-probe | yes-docs | server-docs | yes-docs | yes-docs | yes-docs | partial-docs |
| Remote Streamable HTTP | yes-docs | yes-docs | server-docs | yes-docs | yes-docs | yes-docs | yes-docs |
| Deprecated HTTP+SSE / SSE | unknown | yes-docs | unknown | partial-docs | unknown | yes-docs | unknown |
| Bearer header / static headers | yes-docs | yes-docs | server-docs | yes-docs | yes-docs | yes-docs | yes-docs |
| OAuth for remote MCP | yes-docs | yes-docs | no-docs | yes-docs | partial-docs | yes-docs | unknown |
| CIMD instead of Dynamic Client Registration | unknown | yes-docs | unknown | yes-docs | unknown | unknown | unknown |
| Exact statelessness of MCP `2026-07-28` | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| `server/discover` | no-probe | unknown | unknown | unknown | unknown | unknown | unknown |
| Per-request `_meta` with protocol version and capabilities | no-probe | unknown | unknown | unknown | unknown | unknown | unknown |
| HTTP metadata headers: `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| `x-mcp-header` from tool parameters | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| `resultType`, MRTR and `input_required` | unknown | partial-docs | unknown | partial-docs | unknown | unknown | unknown |
| Elicitation Form Mode | unknown | yes-docs | unknown | partial-docs | unknown | unknown | unknown |
| Elicitation URL Mode | unknown | yes-docs | unknown | unknown | unknown | unknown | unknown |
| `subscriptions/listen` and list-changed invalidation | unknown | partial-docs | unknown | unknown | unknown | unknown | unknown |
| `ttlMs` and `cacheScope` | unknown | partial-docs | unknown | unknown | unknown | unknown | unknown |
| JSON Schema 2020-12, `outputSchema`, `structuredContent` | yes-probe | partial-docs | server-docs | yes-docs | unknown | partial-docs | unknown |
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

## Main Sources

- MCP specification, changelog, deprecated features, Streamable HTTP, Elicitation, Tasks and Caching: <https://modelcontextprotocol.io/>
- OpenCode MCP documentation: <https://opencode.ai/docs/mcp-servers/>
- Claude Code MCP documentation: <https://code.claude.com/docs/en/mcp.md>
- Perplexity MCP server documentation: <https://docs.perplexity.ai/guides/mcp-server>
- OpenAI/Codex MCP documentation: <https://developers.openai.com/codex/extend/mcp> and <https://platform.openai.com/docs/mcp>
- VS Code and GitHub Copilot MCP documentation: <https://code.visualstudio.com/docs/copilot/chat/mcp-servers> and <https://docs.github.com/>
- Gemini CLI MCP documentation: <https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md>
- MCP Extension Matrix: <https://modelcontextprotocol.io/extensions/client-matrix>
