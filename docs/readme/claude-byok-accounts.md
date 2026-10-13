# Claude and Codex API accounts (BYOK)

In **Settings → Accounts → Claude**, choose **Add API key**, enter an account name,
key and API base URL, then save. The URL must serve the Anthropic Messages API;
an OpenAI-only endpoint cannot be used by Claude Code. Use the base URL, without
`/v1/messages`. HTTPS is required except for localhost testing.

Select the saved account in the existing Claude account selector. New Claude
launches in Orca use that account, including `claude` typed in an existing Orca
terminal and native chats. Running Claude processes keep their account until
restarted. Selecting an OAuth account or System default uses that account's
folder again. Shells outside Orca's profile routing are unchanged.

For a multi-workspace Anthropic key, enter **Anthropic workspace ID** (`wrkspc_...`).
Organization UUIDs are not workspace IDs. Orca sets `ANTHROPIC_CUSTOM_HEADERS` to
`anthropic-workspace-id: <id>` in this account's Claude settings. Clearing the field
removes the header; other accounts do not inherit it. See
[Anthropic workspace selection](https://platform.claude.com/docs/en/manage-claude/authentication#select-a-workspace).

Both dialogs include **Test connection**. It sends a short message using the draft
key, endpoint, model and workspace/project. The provider may bill that request.
It does not save or select the account. Success clears from view when the draft
changes. Errors distinguish workspace access, key permissions, model, rate limit
and billing without displaying provider response bodies or credentials.

The default model and Opus/Sonnet/Haiku mappings are optional. Set them to the IDs
advertised by your gateway when it does not accept Claude's standard model names.
Saving checks the configuration format; it does not verify the key with a provider
or incur an API request. API usage and billing are available from the provider,
not the Claude subscription quota endpoint.

The key is stored in the execution host's private
`claude-profiles/<account-id>/home/.orca-api-account.json` and in that profile's
`settings.json`, which Claude reads directly. These files contain plaintext keys
with owner-only file permissions (0600 on POSIX, restricted user ACLs on Windows).
They are not encrypted. The account list and Orca settings contain only the display
name, endpoint, workspace/project IDs and model mappings. Profile refreshes preserve the account's own API
configuration while continuing to copy unrelated preferences and share history.
The default Claude settings and OAuth credentials are not rewritten.

Use `orca account edit` to rename an API account, change its endpoint/model mappings
or rotate its key. `--workspace-id ""` clears an Anthropic workspace. Omitted fields are preserved; an empty model flag clears that
override. Edits preserve the account ID, selection and history, and apply to new
Claude sessions. A failed write restores the previous key and metadata. Removal
deletes its private profile through the existing account removal flow. Adding API
accounts is available on the native desktop host or through its local Orca CLI;
WSL registration and registration through a paired web client are not supported.
Existing remote account selection
and removal still belong to the execution host.

Claude's managed organization policies and explicit project/command-line settings
can take precedence over user profile settings. See the official
[gateway setup](https://code.claude.com/docs/en/llm-gateway) and
[settings precedence](https://code.claude.com/docs/en/settings) documentation.

Verification includes account lifecycle, OAuth/API/System default switching,
secret omission from summaries, private file permissions, profile refresh,
validation/rollback, form retry/reset and skipped subscription polling. A hidden
Electron check also verified form registration and selection through real IPC.
An opt-in
test runs the installed Claude CLI against a local fake gateway, using a dummy key:

```sh
ORCA_BACKGROUND_LAUNCH=1 ORCA_REAL_CLAUDE_CLI_TEST=1 pnpm test src/main/claude-accounts/claude-api-key-real-cli.test.ts
```

The CLI supports the same account lifecycle. Supply the key through a pipe or
redirect a private key file, keeping it out of command arguments and shell history.
An older running Orca is rejected before stdin is read. Use the checkout CLI as
`node out/cli/index.js` until this build is installed.

```sh
orca account add --agent claude --api-key-stdin --label EasyPanel --base-url https://your-gateway.example < /path/to/key
orca account test --agent claude --api-key-stdin --workspace-id wrkspc_EXAMPLE < /path/to/key
orca account list --agent claude
orca account show --agent claude --account ACCOUNT_ID --json
orca account edit --agent claude --account ACCOUNT_ID --label Gateway --model proxy-model --json
orca account edit --agent claude --account ACCOUNT_ID --api-key-stdin < /path/to/new-key
orca account edit --agent claude --account ACCOUNT_ID --model ""
orca account select --agent claude --account ACCOUNT_ID
orca account select --agent claude --account system
orca account rm --agent claude --account ACCOUNT_ID
```

All commands support `--json` for agents. `account update` is an alias for
`account edit`, and `account remove` is an alias for `account rm`. `show` returns
account metadata, active status, endpoint and model mappings, never the API key.
`list --agent claude --json` returns only Claude accounts. Edits without
`--api-key-stdin` do not read stdin. Unknown IDs, unsupported account types, invalid
fields and older runtimes are rejected before a replacement key is consumed.

## Codex BYOK

Settings → Accounts → Codex → **Add API key** supports an OpenAI key or a
Responses-compatible gateway. Supply a model ID and a base URL (default
`https://api.openai.com/v1`), plus optional OpenAI organization/project IDs.
Chat Completions-only gateways are not supported.

The account uses its own `codex-accounts/<id>/home` with private `auth.json`,
`.orca-api-account.json` and `config.toml`. The `orca-byok` custom provider sets
the key, endpoint, model and headers explicitly so inherited authentication cannot
silently replace them. Files are plaintext with owner-only permissions. Initial
non-authentication preferences are copied from the system config; subsequent BYOK
preferences remain in the account folder. Its config is never promoted into the
system config, preventing credential or provider leakage between accounts.
Normal OAuth accounts retain their existing sync behavior. Account removal deletes
the private folder. Running agent processes must be restarted after an edit/switch.

```sh
orca account add --agent codex --api-key-stdin --label OpenAI --model MODEL_ID --project-id proj_EXAMPLE < /path/to/key
orca account test --agent codex --api-key-stdin --model MODEL_ID --project-id proj_EXAMPLE < /path/to/key
orca account list --agent codex --json
orca account show --agent codex --account ACCOUNT_ID --json
orca account edit --agent codex --account ACCOUNT_ID --project-id "" --model OTHER_MODEL
orca account edit --agent codex --account ACCOUNT_ID --api-key-stdin < /path/to/new-key
orca account select --agent codex --account ACCOUNT_ID
orca account rm --agent codex --account ACCOUNT_ID
```

Tests run the installed Codex CLI against a local fake Responses server with a
dummy key (`ORCA_REAL_CODEX_CLI_TEST=1` and
`src/main/codex-accounts/codex-api-key-real-cli.test.ts`). This verifies the model,
project header and bearer token without paid requests. See
[OpenAI provider configuration](https://developers.openai.com/codex/config-reference).

## Installing this fork later

The source checkout and its isolated preview do not update `/Applications/Orca.app`.
Package a tested build using the repository's macOS build flow, preserve a rollback
copy of the installed application and its user data, quit Orca, then replace the
application bundle and relaunch. Keep the Orca app identity and user-data location
so the existing workspaces and accounts remain available. A restart can interrupt
active sessions; do the replacement only when the user is ready.

The built-in **Choose a Local Orca Build** flow takes the generated update manifest
and validates state/protocol compatibility, but it also requires the same valid
code signature as the installed app. An independently signed fork cannot use that
path to replace the official signed application. It needs a separate installation
or a deliberate bundle replacement with the fork's signing setup.

Packaging still targets `stablyai/orca` for official updates in
`config/electron-builder.config.cjs`. Before making the fork the daily application,
configure its own release/update channel (or manage updates manually) so a later
official update does not remove these changes. Publishing a fork release and
installing it are separate actions from this local implementation.
