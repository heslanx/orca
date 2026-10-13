import { testApiAccount } from './api-account-test'
import { CodexApiKeyAccountUpdateSchema } from '../../shared/codex-api-key-account'
import type { CommandHandler } from '../dispatch'
import { printResult } from '../format'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import { RuntimeClientError } from '../runtime-client'
import { ClaudeApiKeyAccountUpdateSchema } from '../../shared/claude-api-key-account'
import {
  CODEX_API_KEY_RUNTIME_CAPABILITY,
  CLAUDE_API_KEY_EDIT_RUNTIME_CAPABILITY,
  CLAUDE_API_KEY_WORKSPACE_RUNTIME_CAPABILITY
} from '../../shared/protocol-version'
import type {
  CodexRateLimitAccountsState,
  ClaudeRateLimitAccountsState
} from '../../shared/managed-account-types'
import { getWslAccountTarget } from './account-wsl-location'
import { formatAccountsBlock } from './account-list-format'
import {
  type ClaudeAccountCommandContext as Context,
  claudeAccountTextFlag as textFlag,
  readClaudeApiKeyInput,
  requireClaudeApiCapability
} from './claude-api-account-input'

function requireAccountId(ctx: Context): string {
  rejectRemoteSelectionFlags(
    ctx.flags,
    '`orca account`. Run it on the host whose accounts you want to manage.'
  )
  if (
    ctx.flags.get('agent') !== undefined &&
    ctx.flags.get('agent') !== 'claude' &&
    ctx.flags.get('agent') !== 'codex'
  ) {
    throw new RuntimeClientError(
      'invalid_argument',
      'This command currently supports --agent claude or codex.'
    )
  }
  const id = textFlag(ctx, 'account')
  if (!id || id === 'system') {
    throw new RuntimeClientError(
      'invalid_argument',
      'Provide a saved Claude account ID with --account.'
    )
  }
  return id
}

async function getClaudeAccounts(ctx: Context) {
  const response = await ctx.client.call<{
    claude: ClaudeRateLimitAccountsState
    codex: CodexRateLimitAccountsState
  }>('accounts.list', { refreshUsage: false })
  return {
    ...response,
    result: ctx.flags.get('agent') === 'codex' ? response.result.codex : response.result.claude
  }
}

function findAccount(
  state: ClaudeRateLimitAccountsState | CodexRateLimitAccountsState,
  id: string
) {
  const account = state.accounts.find((item) => item.id === id)
  if (!account) {
    throw new RuntimeClientError(
      'not_found',
      'Claude account not found. Run orca account list --agent claude.'
    )
  }
  return account
}

export async function listClaudeAccounts(ctx: Context): Promise<void> {
  printResult(await getClaudeAccounts(ctx), ctx.json, (state) =>
    formatAccountsBlock(ctx.flags.get('agent') === 'codex' ? 'Codex' : 'Claude', state, true)
  )
}

export async function showClaudeAccount(ctx: Context): Promise<void> {
  const id = requireAccountId(ctx)
  const response = await getClaudeAccounts(ctx)
  const account = findAccount(response.result, id)
  const active =
    response.result.activeAccountId === id ||
    Object.values(response.result.activeAccountIdsByRuntime?.wsl ?? {}).includes(id)
  printResult({ ...response, result: { ...account, active } }, ctx.json, (value) =>
    [
      `ID: ${value.id}`,
      `Name: ${value.email}`,
      `Authentication: ${value.authMethod ?? 'subscription-oauth'}`,
      `Active: ${value.active}`,
      `Runtime: ${('managedAuthRuntime' in value ? value.managedAuthRuntime : 'managedHomeRuntime' in value ? value.managedHomeRuntime : undefined) ?? 'host'}`,
      ...(value.apiKeyConfig
        ? Object.entries(value.apiKeyConfig).map(
            ([name, setting]) => `${name}: ${setting || '(default)'}`
          )
        : [])
    ].join('\n')
  )
}

export async function editClaudeApiAccount(
  ctx: Context,
  input: AsyncIterable<Uint8Array | string> = process.stdin
): Promise<void> {
  const accountId = requireAccountId(ctx)
  if (getWslAccountTarget(ctx.cwd)) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Edit Claude API accounts on the native execution host.'
    )
  }
  const rotateKey = ctx.flags.has('api-key-stdin')
  if (rotateKey && ctx.flags.get('api-key-stdin') !== true) {
    throw new RuntimeClientError('invalid_argument', 'Use --api-key-stdin without a value.')
  }
  const codex = ctx.flags.get('agent') === 'codex'
  const invalidFlags = codex
    ? ['workspace-id', 'opus-model', 'sonnet-model', 'haiku-model']
    : ['organization-id', 'project-id']
  if (invalidFlags.some((flag) => ctx.flags.has(flag))) {
    throw new RuntimeClientError(
      'invalid_argument',
      'These configuration flags belong to a different provider.'
    )
  }
  const schema = codex ? CodexApiKeyAccountUpdateSchema : ClaudeApiKeyAccountUpdateSchema
  const patch = schema.safeParse({
    accountId,
    label: textFlag(ctx, 'label'),
    ...(rotateKey ? { apiKey: 'pending-stdin-validation' } : {}),
    config: {
      baseUrl: textFlag(ctx, 'base-url'),
      model: textFlag(ctx, 'model', true),
      ...(codex
        ? {
            organizationId: textFlag(ctx, 'organization-id', true),
            projectId: textFlag(ctx, 'project-id', true)
          }
        : {
            workspaceId: textFlag(ctx, 'workspace-id', true),
            opusModel: textFlag(ctx, 'opus-model', true),
            sonnetModel: textFlag(ctx, 'sonnet-model', true),
            haikuModel: textFlag(ctx, 'haiku-model', true)
          })
    }
  })
  if (!patch.success) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Provide a valid --label, API URL, model mapping or --api-key-stdin.'
    )
  }
  await requireClaudeApiCapability(
    ctx,
    codex ? CODEX_API_KEY_RUNTIME_CAPABILITY : CLAUDE_API_KEY_EDIT_RUNTIME_CAPABILITY
  )
  if (ctx.flags.has('workspace-id')) {
    await requireClaudeApiCapability(ctx, CLAUDE_API_KEY_WORKSPACE_RUNTIME_CAPABILITY)
  }
  const response = await getClaudeAccounts(ctx)
  const account = findAccount(response.result, accountId)
  if (
    account.authMethod !== 'api-key' ||
    ('managedAuthRuntime' in account && account.managedAuthRuntime === 'wsl') ||
    ('managedHomeRuntime' in account && account.managedHomeRuntime === 'wsl')
  ) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Only native Claude API accounts can be edited.'
    )
  }
  const result = await ctx.client.call<ClaudeRateLimitAccountsState>(
    codex ? 'accounts.updateCodexApiKey' : 'accounts.updateClaudeApiKey',
    { ...patch.data, ...(rotateKey ? { apiKey: await readClaudeApiKeyInput(input) } : {}) },
    { timeoutMs: 60_000 }
  )
  printResult(result, ctx.json, (state) =>
    formatAccountsBlock(ctx.flags.get('agent') === 'codex' ? 'Codex' : 'Claude', state, true)
  )
}

export const CLAUDE_ACCOUNT_DETAIL_HANDLERS: Record<string, CommandHandler> = {
  'account test': (ctx) => testApiAccount(ctx),
  'account show': showClaudeAccount,
  'account edit': (ctx) => editClaudeApiAccount(ctx)
}
