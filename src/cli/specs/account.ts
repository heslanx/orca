import { GLOBAL_FLAGS, type CommandSpec } from '../args'

// Why: the desktop "Add account" button is disabled when the UI drives a remote
// runtime (a headless server). These commands run the interactive agent login
// (`claude login` / `codex login`) in the caller's own terminal on the host and
// register the captured account with the local runtime, giving headless hosts a
// way to manage Claude and Codex accounts.
export const ACCOUNT_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['account', 'test'],
    summary: 'Test Claude or Codex API credentials before saving an account',
    usage:
      'orca account test --agent claude|codex --api-key-stdin [--base-url <url>] [--model <id>] [--workspace-id <id>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'agent',
      'api-key-stdin',
      'base-url',
      'model',
      'workspace-id',
      'organization-id',
      'project-id'
    ],
    notes: [
      'Sends a short message to the configured provider, which may incur an API charge. No account is saved. Codex requires --model. A failed test exits with status 1.'
    ]
  },
  {
    path: ['account', 'add'],
    summary: 'Add a managed agent account on this Orca host',
    usage:
      'orca account add [--agent claude|codex|opencode|devin] [--label <name>] [--integration <id>] [--api-key-stdin] [--base-url <url>] [--model <id>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'agent',
      'label',
      'integration',
      'api-key-stdin',
      'base-url',
      'workspace-id',
      'organization-id',
      'project-id',
      'model',
      'opus-model',
      'sonnet-model',
      'haiku-model'
    ],
    notes: [
      'For Claude or Codex BYOK, use --api-key-stdin --label <name>. Pipe the key through stdin; it is never accepted as a flag.',
      'Codex BYOK requires --model and supports --base-url, --organization-id and --project-id.',
      'Optional Claude API flags: --base-url, --model, --opus-model, --sonnet-model, --haiku-model. Registration does not select the account.',
      'Use --workspace-id wrkspc_... for a multi-workspace Anthropic key. Organization IDs are not workspace IDs.',
      'Runs the agent login (`claude login` / `codex login`) in this terminal, then registers the account with the local Orca runtime.',
      'Codex uses device authorization so the browser can complete sign-in from a different machine.',
      'OpenCode 2 uses `opencode auth login --standalone` in private XDG directories. Devin uses `devin auth login --force-manual-token-flow`.',
      'Use --integration <id> to skip the OpenCode integration picker; --label names the saved OpenCode or Devin profile.',
      'OpenCode and Devin profiles apply to new explicit host agent launches. Direct SSH relay and Windows-hosted WSL selection are not supported; run the command on a headless Orca runtime on that host.',
      'Sign in with the account you want to add (e.g. use a private/incognito browser window for a second account).',
      '--agent defaults to claude. Requires the Orca runtime to be running on this machine.'
    ],
    examples: [
      'orca account add',
      'orca account add --agent codex',
      'orca account add --agent claude --api-key-stdin --label Gateway < /path/to/key'
    ]
  },
  {
    path: ['account', 'list'],
    summary: 'List managed agent accounts on this Orca host',
    usage: 'orca account list [--agent claude|codex|opencode|devin] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'agent'],
    notes: [
      'Lists the accounts on this machine. `--environment` / `--pairing-code` are rejected rather than ignored; run it on the host whose accounts you want to see.'
    ],
    examples: ['orca account list']
  },
  {
    path: ['account', 'show'],
    summary: 'Show a saved Claude or Codex account and its configuration without credentials',
    usage: 'orca account show [--agent claude|codex] --account <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'agent', 'account'],
    notes: [
      'Shows metadata only. API keys are never returned. Run this command on the account execution host.'
    ]
  },
  {
    path: ['account', 'edit'],
    aliases: [['account', 'update']],
    summary: 'Edit a Claude or Codex BYOK account or rotate its API key',
    usage:
      'orca account edit [--agent claude|codex] --account <id> [--label <name>] [--base-url <url>] [--model <id>] [--api-key-stdin] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'agent',
      'account',
      'label',
      'base-url',
      'workspace-id',
      'organization-id',
      'project-id',
      'model',
      'opus-model',
      'sonnet-model',
      'haiku-model',
      'api-key-stdin'
    ],
    notes: [
      'Omitted fields keep their current values. Pass an empty string to a model flag to clear that override.',
      'Use --workspace-id wrkspc_... to select the Anthropic workspace; an empty string clears the header.',
      'Use --api-key-stdin to rotate the key through a pipe. Other edits never read stdin.',
      'Changes apply to new Claude sessions. The account ID, selection and history are preserved.',
      'Only native Claude or Codex BYOK accounts can be edited. Run this command on the account execution host.'
    ],
    examples: [
      'orca account edit --account ACCOUNT_ID --label Gateway --model proxy-model --json',
      'orca account edit --account ACCOUNT_ID --api-key-stdin < /path/to/new-key',
      'orca account edit --account ACCOUNT_ID --model ""'
    ]
  },
  {
    path: ['account', 'select'],
    summary: 'Select a Claude, OpenCode or Devin account for new agent launches',
    usage: 'orca account select --agent claude|codex|opencode|devin --account <id|system> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'agent', 'account']
  },
  {
    path: ['account', 'rm'],
    aliases: [['account', 'remove']],
    destructive: true,
    summary: 'Remove a managed Claude, OpenCode or Devin account and its private data',
    usage: 'orca account rm --agent claude|codex|opencode|devin --account <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'agent', 'account'],
    notes: [
      'Deletes credentials and conversation data in the managed profile. Stop its running agents first. System credentials are never removed.'
    ]
  }
]
