import { addCodexApiAccount } from './codex-api-account'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import {
  CLAUDE_API_KEY_RUNTIME_CAPABILITY,
  CLAUDE_API_KEY_WORKSPACE_RUNTIME_CAPABILITY
} from '../../shared/protocol-version'
import {
  ClaudeApiKeyAccountInputSchema,
  ClaudeApiKeyConfigSchema
} from '../../shared/claude-api-key-account'
import type { ClaudeRateLimitAccountsState } from '../../shared/managed-account-types'
import { formatAccountsBlock } from './account-list-format'
import { getWslAccountTarget } from './account-wsl-location'
import {
  type ClaudeAccountCommandContext as Context,
  claudeAccountTextFlag as textFlag,
  readClaudeApiKeyInput,
  requireClaudeApiCapability
} from './claude-api-account-input'

export async function maybeAddClaudeApiAccount(ctx: Context, agent: string): Promise<boolean> {
  if (ctx.flags.has('api-key-stdin')) {
    if (agent === 'codex') {
      await addCodexApiAccount(ctx)
      return true
    }
    if (agent !== 'claude') {
      throw new RuntimeClientError(
        'invalid_argument',
        '--api-key-stdin is supported only for Claude.'
      )
    }
    await addClaudeApiAccount(ctx)
    return true
  }
  if (
    [
      'base-url',
      'model',
      'opus-model',
      'sonnet-model',
      'haiku-model',
      'workspace-id',
      'organization-id',
      'project-id'
    ].some((flag) => ctx.flags.has(flag))
  ) {
    throw new RuntimeClientError(
      'invalid_argument',
      'API configuration flags require --api-key-stdin.'
    )
  }
  return false
}

export async function addClaudeApiAccount(
  ctx: Context,
  input: AsyncIterable<Uint8Array | string> = process.stdin
): Promise<void> {
  if (ctx.flags.get('api-key-stdin') !== true) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Use --api-key-stdin to read a key from a pipe.'
    )
  }
  if (getWslAccountTarget(ctx.cwd)) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Claude API accounts currently require the native execution host.'
    )
  }
  if (ctx.flags.has('organization-id') || ctx.flags.has('project-id')) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Use --workspace-id for Anthropic; organization/project flags belong to Codex.'
    )
  }
  const label = textFlag(ctx, 'label')
  if (!label) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--label is required for a Claude API account.'
    )
  }
  const config = ClaudeApiKeyConfigSchema.safeParse({
    baseUrl: textFlag(ctx, 'base-url'),
    workspaceId: textFlag(ctx, 'workspace-id', true),
    model: textFlag(ctx, 'model'),
    opusModel: textFlag(ctx, 'opus-model'),
    sonnetModel: textFlag(ctx, 'sonnet-model'),
    haikuModel: textFlag(ctx, 'haiku-model')
  })
  if (!config.success) {
    throw new RuntimeClientError('invalid_argument', 'Invalid API URL or model configuration.')
  }
  await requireClaudeApiCapability(ctx, CLAUDE_API_KEY_RUNTIME_CAPABILITY)
  if (ctx.flags.has('workspace-id')) {
    await requireClaudeApiCapability(ctx, CLAUDE_API_KEY_WORKSPACE_RUNTIME_CAPABILITY)
  }
  const parsed = ClaudeApiKeyAccountInputSchema.safeParse({
    label,
    apiKey: await readClaudeApiKeyInput(input),
    config: config.data,
    runtime: 'host'
  })
  if (!parsed.success) {
    throw new RuntimeClientError('invalid_argument', 'Provide one non-empty API key on stdin.')
  }
  const result = await ctx.client.call<ClaudeRateLimitAccountsState>(
    'accounts.addClaudeApiKey',
    parsed.data,
    { timeoutMs: 60_000 }
  )
  printResult(result, ctx.json, (state) =>
    formatAccountsBlock(ctx.flags.get('agent') === 'codex' ? 'Codex' : 'Claude', state, true)
  )
}

export async function mutateClaudeAccount(
  ctx: Context,
  action: 'select' | 'remove'
): Promise<void> {
  const id = textFlag(ctx, 'account')
  if (!id || (action === 'remove' && id === 'system')) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Provide a saved Claude account ID with --account.'
    )
  }
  const result = await ctx.client.call<ClaudeRateLimitAccountsState>(
    `accounts.${action}${ctx.flags.get('agent') === 'codex' ? 'Codex' : 'Claude'}`,
    {
      accountId: id === 'system' ? null : id
    }
  )
  printResult(result, ctx.json, (state) =>
    formatAccountsBlock(ctx.flags.get('agent') === 'codex' ? 'Codex' : 'Claude', state, true)
  )
}
