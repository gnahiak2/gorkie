<div align="center">
  <img alt="gorkie banner" src="./.github/banner.png" />
  <h1>gorkie</h1>
  <p>An AI assistant for Slack, built on Mastra.</p>
</div>

## Introduction

gorkie answers mentions, DMs, and subscribed threads, and runs code in a
sandbox to get those answers. It also runs recurring scheduled tasks on its
own.

The bot is a long-lived Bun process. [Mastra][mastra]'s built-in
[channels][channels] feature handles Slack events, wiring the [Vercel Chat
SDK][chat-sdk] Slack adapter in Socket Mode while the agent runs on Mastra's
native runtime. Each Slack thread gets its own working directory, driven by
Mastra's `LocalSandbox`, so gorkie can run commands and inspect files for that
conversation without them leaking into another.

## Features

- Slack-native replies for mentions, DMs, and subscribed thread follow-ups,
  streamed as they generate, with a typing indicator.
- Single-owner bot: only the `OWNER_USER_ID` account gets replies, and everyone
  else is ignored. The model is picked from the App Home and stored per user.
- Per-thread sandbox sessions: a working directory under `.sandbox/`, one per
  Slack thread, backed by Mastra's `LocalSandbox`, so commands run on the host
  but stay scoped to the conversation.
  Full filesystem access (`read_file`/`write_file`/`edit_file`/`list_files`/
  `delete_file`/`file_stat`) plus shell command execution
  (`execute_command`) with background process support (`get_process_output`,
  `kill_process`).
- Delegated helper agents for research (Slack and web lookups) and codebase
  exploration (read-only workspace inspection), so multi-step digging stays
  out of the main conversation.
- Web search and page fetching via [Exa][exa], plus a Slack "code mode" tool
  for query-driven or exhaustive conversation analysis.
- Slack-native tools: read/summarize conversation history, list threads and
  channels, inspect channels and users, post to another thread/channel/DM,
  upload and download files, react, leave a thread. It reads only the current
  conversation and public channels, and DMs only the person who asked.
- Slack Canvas tools: create, list, read, edit, and look up sections.
- Recurring scheduled tasks (cron-based, create/list/pause/resume/delete).
  Each run posts back into the conversation where it was scheduled.
- Most tools load on demand through tool search, so the base tool list and the
  prompt stay small.
- [Observational Memory][om] compresses a long conversation into an
  observation log instead of carrying the full raw history.
- Mastra Observability tracing, stored locally in DuckDB.

See [TODO.md](./TODO.md) for open work and known issues.

## Tech stack

- [Bun][bun] and TypeScript
- [Mastra][mastra], agent runtime + [channels][channels]
- [Vercel Chat SDK][chat-sdk] with `@chat-adapter/slack` (via Mastra channels)
- [Command Code][command-code] Provider API as the single model gateway, with
  the model chosen from the App Home and a fallback if it fails
- Mastra's `LocalSandbox` for per-thread code execution on the host
- [Exa][exa] for web search and page fetching
- [PostgreSQL][postgres] via `@mastra/pg`
- Mastra Observability, stored locally in [DuckDB][duckdb] in development and
  in Postgres in production

## Getting started

Create a new [Slack app](https://api.slack.com/apps) from a manifest using
[`slack-manifest.json`](./slack-manifest.json), which turns on Socket Mode,
the App Home, scopes, and event subscriptions. You also need [Bun][bun], a
[PostgreSQL][postgres] database, an [Exa][exa] API key, and a
[Command Code][command-code] API key.

```bash
# Clone this repository
git clone https://github.com/gnahiak2/gorkie.git

# Install dependencies
bun install

# Copy and fill in the environment
cp .env.example .env

# Run the bot locally (also serves Mastra Studio at http://localhost:4111)
bun run dev
```

Local development uses Slack Socket Mode, so the bot needs no public HTTP
tunnel to receive Slack events. It logs `[gorkie] online` once connected.

Do not run two local instances against the same Slack app token. Their Socket
Mode connections race, and the resulting behavior is hard to diagnose.

For a production-style run: `bun run build` then `bun run start`.

### Local Postgres database

The default `DATABASE_URL` in [`.env.example`](./.env.example) points at a
local database named `gorkie`. Mastra creates its tables on first run.

## Environment

| Variable | Required | Description |
|---|---|---|
| `SLACK_BOT_TOKEN` | yes | Bot User OAuth token (`xoxb-…`) |
| `SLACK_APP_TOKEN` | yes | App-level token with `connections:write` (`xapp-…`) |
| `SLACK_USER_TOKEN` | yes | Slack user token, not the bot token, used for public-channel search. Mint it with `search:read.public` only; gorkie verifies the granted scopes on first use and refuses the token if it also carries `search:read.im`, `search:read.mpim`, or `search:read.private`. See [docs/slack-search.md](docs/slack-search.md) |
| `OWNER_USER_ID` | yes | The only Slack account gorkie answers (`U…`). Messages from anyone else are ignored |
| `COMMANDCODE_API_KEY` | yes | [Command Code][command-code] Provider API key. Every model, both wire formats |
| `DATABASE_URL` | yes | Postgres connection string |
| `CREDENTIALS_KEY` | yes | Encrypts connected GitHub and MCP tokens at rest (`openssl rand -base64 32`) |
| `GITHUB_APP_SLUG` | yes | The app's URL slug, used to link people to the install page |
| `GITHUB_APP_CLIENT_ID` | yes | GitHub App client id, for the App Home sign-in (see [docs/github-app.md](./docs/github-app.md)) |
| `GITHUB_APP_CLIENT_SECRET` | yes | GitHub App client secret, used to refresh expiring user tokens |
| `EXA_API_KEY` | yes | Exa key, powers `search_web`/`fetch_url` |
| `AGENTMAIL_API_KEY` | no | Lets commands reach the AgentMail API as `gorkie@agentmail.to`. The key is present in the sandbox environment, since there is no firewall to broker it through |

See [`.env.example`](./.env.example) for the full annotated list.

## Project structure

```text
src/
  env.ts                        Zod-validated environment
  mastra/
    index.ts                    Mastra instance: Postgres, Observability, logger, agents
    config.ts                   Sandbox and agent config
    providers.ts                Model gateway definitions (orchestrator, summarizer, scout, explorer, images)
    agents/orchestrator.ts      The agent: model, instructions, memory, tools, channels
    agents/research.ts          Delegated Slack/web research helper agent
    agents/explore.ts           Delegated read-only codebase exploration helper agent
    chat/                       Chat SDK client, handlers, typing status
    workspace/                  Local sandbox workspace (per-thread directory)
    tools/                      Tool registry: Slack, canvas, scheduled tasks, sandbox, web, code mode
    processors/                 Input/output processors (delegated tools, sandbox, tool media)
    prompts/                    System prompt sections (core, personality, Slack, tools)
    mcp/                        MCPClient scaffold for connecting external MCP servers
```

Constructing the Mastra instance registers the agent, which opens the Slack
Socket Mode connection.

## Development

```bash
bun run dev             # Mastra Studio and the Slack bot
bun run build           # Production build
bun run start           # Run the production build
bun run typecheck
bun run check           # Biome/ultracite
bun run check:spelling
```

## License

[AGPL-3.0](./LICENSE)

[mastra]: https://mastra.ai
[channels]: https://mastra.ai/docs/channels/overview
[chat-sdk]: https://github.com/vercel/chat-sdk
[exa]: https://exa.ai
[command-code]: https://commandcode.ai/docs/provider
[postgres]: https://www.postgresql.org
[duckdb]: https://duckdb.org
[bun]: https://bun.sh
[om]: https://mastra.ai/docs/memory/observational-memory
