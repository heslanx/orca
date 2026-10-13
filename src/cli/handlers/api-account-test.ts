import {
  ApiAccountConnectionInputSchema,
  type ApiAccountConnectionResult
} from '../../shared/api-account-connection'
import { API_ACCOUNT_TEST_RUNTIME_CAPABILITY } from '../../shared/protocol-version'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import { RuntimeClientError } from '../runtime-client'
import { printResult } from '../format'
import {
  type ClaudeAccountCommandContext as Context,
  claudeAccountTextFlag as textFlag,
  requireClaudeApiCapability,
  readClaudeApiKeyInput
} from './claude-api-account-input'

export async function testApiAccount(
  ctx: Context,
  input: AsyncIterable<Uint8Array | string> = process.stdin
): Promise<void> {
  rejectRemoteSelectionFlags(ctx.flags, 'Run account tests on the execution host.')
  const provider = ctx.flags.get('agent') ?? 'claude'
  if (ctx.flags.get('api-key-stdin') !== true) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Pipe the key through --api-key-stdin to test an account configuration.'
    )
  }
  const parsed = ApiAccountConnectionInputSchema.safeParse({
    provider,
    apiKey: 'pending-input',
    config: {
      baseUrl: textFlag(ctx, 'base-url'),
      model: textFlag(ctx, 'model'),
      ...(provider === 'claude'
        ? { workspaceId: textFlag(ctx, 'workspace-id', true) }
        : {
            projectId: textFlag(ctx, 'project-id', true),
            organizationId: textFlag(ctx, 'organization-id', true)
          })
    }
  })
  if (!parsed.success) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Provide a valid provider, URL, model and workspace/project ID.'
    )
  }
  await requireClaudeApiCapability(ctx, API_ACCOUNT_TEST_RUNTIME_CAPABILITY)
  const result = await ctx.client.call<ApiAccountConnectionResult>(
    'accounts.testApiKey',
    { ...parsed.data, apiKey: await readClaudeApiKeyInput(input) },
    { timeoutMs: 30_000 }
  )
  printResult(
    result,
    ctx.json,
    (value) =>
      `${value.ok ? 'Verified' : 'Failed'}: ${value.message}${value.status ? ` (HTTP ${value.status})` : ''}`
  )
  if (!result.result.ok) {
    process.exitCode = 1
  }
}
