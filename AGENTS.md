# AGENTS.md

## Project

joebot: a personal terminal AI assistant. Node.js CLI and server, tool calling agent with multi provider fallback (groq, openrouter, gemini).

## Environment constraints

* Runs in Termux on Android.
* Prefer short commands that are easy to paste and rerun. File edits use cat with EOF heredocs.
* Assume no nano or vim workflow and no mouse.

## Code style

- No dashes in code, comments, or output text.
- No emoji anywhere in code, output, or UI.
- Prefer plain, direct error messages over clever ones.

## Architecture rules

- server/ai/router.js is the single entry point for model calls. Never call a provider file directly from elsewhere.
- Every provider in server/ai/providers must return {reply, toolCalls, raw} or throw.
- Tool schemas are defined once in server/tools/index.js in OpenAI function calling format. Provider specific files must adapt that shape themselves, never change the shared schema to suit one provider.
- Composio tools only fire when the user explicitly requests them, this is enforced through the use_composio tool description, not a separate gate. Do not make Composio automatic without an explicit decision to change this.
- Filesystem access is sandboxed. Do not widen file or shell access without an explicit instruction, and log the change in this file when it happens.

## Known constraints in progress

- Gemini schema compatibility: Gemini rejects additionalProperties and $schema keys in function parameters. Any new tool must go through the same stripping step gemini.js already applies, or a new shared schema sanitizer if one gets added later.
* Model fallback moves to the next provider on any provider error, including empty results, and reports every provider failure if all of them fail. It does not judge low quality replies.

## Before committing

- Never commit .env, data/conversations.json, data/profile.json, or node_modules.
- Confirm git status is clean of secrets before every commit, not just the first one.
