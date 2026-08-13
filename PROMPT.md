# MCP Client Compatibility Probe Prompt

Use this prompt after cloning the repository. Paste it into the MCP-capable assistant you want to test.

You may replace the placeholders before running, but the assistant should infer or ask for missing values when possible:

- `CLIENT_NAME`: the client under test, for example `claude-code`, `opencode`, `codex-cli`, `chatgpt-desktop`, `cursor`, `vscode-copilot`
- `TRACE_FILE`: the trace path configured through `MCP_PROBE_TRACE`, for example `/tmp/mcp-probe-claude-code.ndjson`. If omitted, use `/tmp/mcp-probe-CLIENT_NAME-USERNAME-YYYY-MM-DD.ndjson`.

## Prompt

```text
You are testing MCP client compatibility with the local repository `mcp-client-compat-probe`.

Client under test: CLIENT_NAME
Trace file: TRACE_FILE

Goal:
Run the local MCP probe tests as autonomously as possible, inspect the trace, write one result file under `results/`, and prepare a commit. Do not push without explicit user confirmation.

The point of the exercise is to measure how far this client has actually adopted the MCP revision `2026-07-28`, based on observed wire behavior rather than on documentation or on the client's own claims. The probe answers `supportedVersions: ["2026-07-28", "2025-11-25", "2025-06-18"]`, so a client may negotiate down, and doing so is a valid and interesting result. Report what the trace shows, including a client that only speaks the older surface well.

Intent:
Read the steps below as a description of the result that is wanted, not as a script to execute literally. Clients, machines and repositories differ, and the steps cannot anticipate every combination. Where a step does not fit what is actually in front of you, follow the intent, do the equivalent thing, and say in your report what you did differently and why. A condition that does not literally apply is not a reason to skip the purpose behind it.

- The result is a contribution to a shared, public collection: one file per client, per tester, per day, comparable across clients and traceable to a specific probe commit. Anything that helps a later reader compare two clients belongs in it.
- The trace is the evidence. Client documentation, the client's description of itself, and your own impression of how the conversation went are not evidence. Where they disagree, the trace decides.
- Negative and partial results are worth exactly as much as positive ones. The whole point is to replace assumptions about client support with observations, so `no` and `partial` are valid answers, not signs of a failed run.
- A limit you run into is itself data. If a step needs the user, or the client hides something from you, record that as precisely as the parts that worked, rather than routing around it silently.
- Never fabricate or assume a result you did not observe. If something stayed untested, mark it `unknown` and say what would be needed to test it.
- Apart from the new result file, the working tree should come out unchanged. If you think something else has to change, ask first.

Rules:
- Do not edit probe server implementation files unless the smoke test fails because of a local setup issue and the user approves the fix.
- Do not include secrets, tokens, private prompts, or full sensitive trace contents in the result file.
- Include only small trace excerpts needed as evidence.
- Determine `USERNAME` in this exact order, and stop at the first one that works:
  1. If `origin` points at GitHub and `gh auth status` shows an authenticated account, use that account name.
  2. Otherwise, use the owner segment of the `origin` URL if the repository is clearly the user's own.
  3. Otherwise, use `git config user.name`, reduced to a short lowercase token without spaces.
  4. Otherwise, ask the user for a short username.
  Result files from many testers are collected in one shared, public repository, so `USERNAME` has to identify the contributor there, not on their local machine. A local git name is often an initial or a real name that means nothing to other readers. If the local git name and the hosting account differ, prefer the hosting account and state in your report which one you used and why.
- Use the current date in ISO format.
- Result filename format: `results/CLIENT_NAME-USERNAME-YYYY-MM-DD.md`. Use the same `USERNAME` in the file's `Tester:` field and in the commit message.
- If multiple result files for the same client/user/date already exist, append `-2`, `-3`, etc.
- Ask the user only when blocked by something you cannot do yourself, such as restarting the client, confirming the client name, approving a config change, or approving push/PR creation.
- If `CLIENT_NAME` is not replaced, infer it from the current assistant/client. If unsure, ask one short question.
- If `TRACE_FILE` is not replaced, compute a default trace path using the inferred client name, username, and current date.
- Clients differ in how much of MCP the assistant can reach on its own. Some expose a primitive only through user-initiated UI, such as a slash command, a tool picker, or a settings panel. If you cannot trigger a step yourself, that limitation is itself a result: name the exact action the user must perform, wait for it, then record both the outcome and the fact that it needed a human. Do not silently skip the step, and do not substitute a direct call to the server outside the client, because that would test the probe rather than the client.

Steps:

1. Check repository state.
   - Run `git status --short`.
   - If there are unexpected local changes, report them and ask before modifying anything.

2. Check local runtime.
   - Run `node --version` and `npm run smoke`.
   - If `node` or `npm` is not on `PATH`, do not stop yet. Look for a usable Node binary, for example one bundled with an installed editor or tool, and verify it reports version 20 or higher. The smoke script spawns the server via `process.execPath`, so running `node scripts/smoke-stdio.mjs` with an absolute Node path is equivalent to `npm run smoke`.
   - Record in the result file which runtime you used and whether `npm run smoke` itself was runnable.
   - If the smoke test itself fails, stop and report the error.

3. Confirm or set up MCP server configuration.
   - Check whether the client has the local `stdio-server.mjs` configured as an MCP server.
   - If the client has a writable local config and you know the correct format, add or update the MCP config yourself, preserving unrelated settings.
   - If the client config cannot be edited safely, tell the user the exact config needed.
   - Ensure `MCP_PROBE_TRACE` points to `TRACE_FILE`.
   - If step 2 required an absolute Node path, use that same absolute path as the MCP server command, and note in the result file that the path is tied to that installation.
   - If the client requires a restart to load MCP config, first write your findings so far to a scratch file, because a restart may discard your conversation context. Then tell the user to restart, including the command or menu action that preserves the session if the client offers one, and resume from this step afterwards.
   - If the MCP server is already connected, continue without asking.

4. Run probe interactions through MCP tools/resources/prompts when available.
   - T1: Use `echo_meta` and record the received `_meta` fields.
   - T2: Use `structured_result` with label `CLIENT_NAME`.
   - T3: Use `create_handle` with target `confluence`, then `use_handle` with query `release notes`.
   - T4: Use `tool_error` and record whether it is treated as a tool execution error.
   - T5: Try to read/summarize the `probe://server/overview` resource.
   - T6: Try to use the `probe_summary` prompt for `CLIENT_NAME`. Whether the assistant can invoke a prompt itself varies by client, so first check for a way to do it directly. If there is none, find the exact user-facing invocation the client offers, tell the user the literal command to type, and record whether the prompt was assistant-reachable or user-only.
   - T7: Try `needs_form_input` for topic `CLIENT_NAME elicitation`. Record three things separately, because they can diverge: whether the client declared elicitation support and with which modes, whether the retry carried `inputResponses` and `requestState`, and whether a form was actually shown. You cannot see the client UI yourself, so ask the user whether a form appeared. If the returned values match the `default` values in the server's `requestedSchema`, the client likely auto-accepted without asking anyone; say so, and note that a schema field without a default was not exercised.
   - T8: Use `search` with query `probe`, then `fetch` the first result.

5. Inspect `TRACE_FILE`.
   - Determine the highest protocol version the client actually negotiated, and whether it matches the version it announces in `_meta`.
   - Determine whether `initialize` was used.
   - Determine whether `server/discover` and `subscriptions/listen` were used.
   - Determine whether `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get` occurred.
   - Determine whether per-request `_meta.io.modelcontextprotocol/protocolVersion` occurred.
   - Determine whether per-request `_meta.io.modelcontextprotocol/clientCapabilities` occurred.
   - Determine whether elicitation capability was declared, and whether it names concrete modes or is an empty object.
   - Determine whether `input_required` was retried with `inputResponses` and `requestState`. Compare any request id or vendor-specific call id across the first attempt and the retry: an identical id means the client handled the round trip internally, below the assistant's view.
   - Note any vendor-specific `_meta` keys the client adds beyond the standard ones, and whether the trace contains several server processes, for example from a separate health check, since those lines are not part of the interactive run.

6. Create the result markdown file.
   - Use the template from `TESTPLAN.md`, keeping its three Summary Matrix blocks so a reader can tell at a glance whether the client has adopted the `2026-07-28` surface or only handles the established one.
   - Fill every Summary Matrix row with `yes`, `partial`, `no`, or `unknown`.
   - Add concise evidence: trace line numbers if available, method names, or short excerpts.

7. Validate before commit.
   - Run `npm run smoke` again.
   - Run `git diff -- results/`.
   - Verify no secrets are included.

8. Prepare the contribution.
   - Do not commit onto the default branch. Create a branch first, for example `probe-result-CLIENT_NAME-USERNAME`.
   - Stage only the new result file.
   - Commit message format: `Add CLIENT_NAME probe result USERNAME YYYY-MM-DD`.
   - Do not push unless the user explicitly says to push.
   - A pull request is the normal way to contribute a result, because results from many testers are collected centrally. Do not decide this from whether the repository is a fork: a plain `git clone` is never a fork, so that test is almost always wrong. What decides it is write access, and a public repository grants read access only. Check the actual permission, for example with `gh repo view --json viewerPermission`.
   - Once the user approves, take the first of these routes that works, and say in your report which one you took:
     1. You have write access to the upstream repository: push the branch there and open the pull request.
     2. No write access, GitHub CLI available and authenticated: create a fork with `gh repo fork --remote`, push the branch to that fork, and open the pull request against the upstream repository. This needs no permissions on the upstream repository at all.
     3. No usable GitHub CLI: tell the user to open an issue on the upstream repository and attach the result file.
     4. No GitHub access at all: tell the user to send the result file to the repository author directly, together with the client version, the operating system, and the redacted MCP config.
   - Never route around missing permissions by force-pushing, by rewriting shared history, or by committing to the default branch.

9. Report back.
   - State the result file path.
   - Summarize major observed support and gaps.
   - If not pushed, tell the user the command they can run: `git push`.
```

## Notes For Any Client

Tool names differ between clients. They may carry server-name prefixes, appear in a tool picker, or be renamed entirely. Use whatever names the client presents; the underlying MCP methods must still appear in `TRACE_FILE`, and the trace is the authority, not the client's own description of itself.

Expect the assistant's reach to stop somewhere. Different clients draw the line in different places: one may let the assistant read resources but not invoke prompts, another may do the opposite, and a third may hide `input_required` handling entirely inside its client layer. Finding that boundary is a goal of the test, not an obstacle to it, so record where it sits instead of working around it.

## Client-Specific Observations

These are starting points, not expectations to confirm. Verify each one against the trace of your own run.

- **Claude Code**: uses `server/discover` without an `initialize` fallback, sends full per-request `_meta`, and gives the assistant dedicated tools for MCP resources but none for prompts, so T6 requires the user to type the slash command. T7 completes protocol-correctly but without any visible form. See `results/claude-code-kascada-2026-08-13.md`.
- **OpenCode**: uses `initialize`, calls `prompts/get` on its own, and sends only `progressToken` in tool-call `_meta`. See the baseline in `TESTPLAN.md`.
