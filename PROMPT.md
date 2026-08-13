# MCP Client Compatibility Probe Prompt

Use this prompt after cloning the repository. Paste it into the MCP-capable assistant you want to test.

Replace the placeholders before running:

- `CLIENT_NAME`: the client under test, for example `claude-code`, `opencode`, `codex-cli`, `chatgpt-desktop`, `cursor`, `vscode-copilot`
- `TRACE_FILE`: the trace path configured through `MCP_PROBE_TRACE`, for example `/tmp/mcp-probe-claude-code.ndjson`

## Prompt

```text
You are testing MCP client compatibility with the local repository `mcp-client-compat-probe`.

Client under test: CLIENT_NAME
Trace file: TRACE_FILE

Goal:
Run the local MCP probe tests, inspect the trace, write one result file under `results/`, and prepare a commit. Do not push without explicit user confirmation.

Rules:
- Do not edit probe server implementation files unless the smoke test fails because of a local setup issue and the user approves the fix.
- Do not include secrets, tokens, private prompts, or full sensitive trace contents in the result file.
- Include only small trace excerpts needed as evidence.
- Use the git username from local git config if available; otherwise ask the user for a short username.
- Use the current date in ISO format.
- Result filename format: `results/CLIENT_NAME-USERNAME-YYYY-MM-DD.md`.
- If multiple result files for the same client/user/date already exist, append `-2`, `-3`, etc.

Steps:

1. Check repository state.
   - Run `git status --short`.
   - If there are unexpected local changes, report them and ask before modifying anything.

2. Check local runtime.
   - Run `node --version`.
   - Run `npm run smoke`.
   - If smoke fails, stop and report the error.

3. Confirm MCP server configuration.
   - Check whether the client has the local `stdio-server.mjs` configured as an MCP server.
   - If not configured, tell the user the exact config needed for this client if known.
   - Ensure `MCP_PROBE_TRACE` points to `TRACE_FILE`.
   - If the client requires restart to load MCP config, tell the user to restart and then resume.

4. Run probe interactions through MCP tools/resources/prompts when available.
   - T1: Use `echo_meta` and record the received `_meta` fields.
   - T2: Use `structured_result` with label `CLIENT_NAME`.
   - T3: Use `create_handle` with target `confluence`, then `use_handle` with query `release notes`.
   - T4: Use `tool_error` and record whether it is treated as a tool execution error.
   - T5: Try to read/summarize the `probe://server/overview` resource.
   - T6: Try to use the `probe_summary` prompt for `CLIENT_NAME`.
   - T7: Try `needs_form_input` for topic `CLIENT_NAME elicitation` and record whether the client handles `input_required`/MRTR.
   - T8: Use `search` with query `probe`, then `fetch` the first result.

5. Inspect `TRACE_FILE`.
   - Determine whether `initialize` was used.
   - Determine whether `server/discover` was used.
   - Determine whether `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get` occurred.
   - Determine whether per-request `_meta.io.modelcontextprotocol/protocolVersion` occurred.
   - Determine whether per-request `_meta.io.modelcontextprotocol/clientCapabilities` occurred.
   - Determine whether elicitation capability was declared.
   - Determine whether `input_required` was retried with `inputResponses` and `requestState`.

6. Create the result markdown file.
   - Use the template from `TESTPLAN.md`.
   - Fill every Summary Matrix row with `yes`, `partial`, `no`, or `unknown`.
   - Add concise evidence: trace line numbers if available, method names, or short excerpts.

7. Validate before commit.
   - Run `npm run smoke` again.
   - Run `git diff -- results/`.
   - Verify no secrets are included.

8. Prepare commit.
   - Stage only the new result file.
   - Commit message format: `Add CLIENT_NAME probe result USERNAME YYYY-MM-DD`.
   - Do not push unless the user explicitly says to push.

9. Report back.
   - State the result file path.
   - Summarize major observed support and gaps.
   - If not pushed, tell the user the command they can run: `git push`.
```

## Notes For Claude Code

Claude Code may expose MCP tools with server-name prefixes or through its own tool picker. Use whatever tool names the client presents, but the underlying MCP methods should still appear in `TRACE_FILE`.

If Claude Code supports Elicitation Form Mode, T7 should result in a user-facing form and then a retry containing `inputResponses`.
