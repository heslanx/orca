import {
  CodexApiKeyAccountInputSchema,
  CodexApiKeyConfigSchema
} from '../../shared/codex-api-key-account'
import { CODEX_API_KEY_RUNTIME_CAPABILITY } from '../../shared/protocol-version'
import type { CodexRateLimitAccountsState } from '../../shared/managed-account-types'
import { RuntimeClientError } from '../runtime-client'
import { printResult } from '../format'
import { formatAccountsBlock } from './account-list-format'
import { getWslAccountTarget } from './account-wsl-location'
import {
  type ClaudeAccountCommandContext as Context,
  claudeAccountTextFlag as textFlag,
  readClaudeApiKeyInput,
  requireClaudeApiCapability
} from './claude-api-account-input'

export async function addCodexApiAccount(
  ctx: Context,
  input: AsyncIterable<Uint8Array | string> = process.stdin
): Promise<void> {
  if (ctx.flags.get('api-key-stdin') !== true || getWslAccountTarget(ctx.cwd)) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Use --api-key-stdin on the native execution host.'
    )
  }
  if (
    ['workspace-id', 'opus-model', 'sonnet-model', 'haiku-model'].some((flag) =>
      ctx.flags.has(flag)
    )
  ) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Claude workspace/model aliases are not supported for Codex.'
    )
  }
  const label = textFlag(ctx, 'label')
  const config = CodexApiKeyConfigSchema.safeParse({
    baseUrl: textFlag(ctx, 'base-url'),
    model: textFlag(ctx, 'model'),
    organizationId: textFlag(ctx, 'organization-id', true),
    projectId: textFlag(ctx, 'project-id', true)
  })
  if (!label || !config.success) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Provide --label, --model and a valid API URL and organization/project IDs.'
    )
  }
  await requireClaudeApiCapability(ctx, CODEX_API_KEY_RUNTIME_CAPABILITY)
  const parsed = CodexApiKeyAccountInputSchema.safeParse({
    label,
    config: config.data,
    apiKey: await readClaudeApiKeyInput(input),
    runtime: 'host'
  })
  if (!parsed.success) {
    throw new RuntimeClientError('invalid_argument', 'Provide one non-empty API key on stdin.')
  }
  const result = await ctx.client.call<CodexRateLimitAccountsState>(
    'accounts.addCodexApiKey',
    parsed.data,
    { timeoutMs: 60_000 }
  )
  printResult(result, ctx.json, (state) => formatAccountsBlock('Codex', state, true))
}
