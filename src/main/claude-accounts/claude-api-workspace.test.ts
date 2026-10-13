import { expect, it } from 'vitest'
import { ClaudeApiKeyConfigSchema } from '../../shared/claude-api-key-account'
import { claudeApiKeyProfileSettings } from './claude-api-key-profile'

it.each(['organization-uuid', 'wrkspc_a\nAuthorization: secret', 'wrkspc_'])(
  'rejects invalid workspace %s',
  (workspaceId) => {
    expect(ClaudeApiKeyConfigSchema.safeParse({ workspaceId }).success).toBe(false)
  }
)
it.each(['wrkspc_test', '', undefined])(
  'overrides stale workspace headers with the account workspace %s',
  (workspaceId) => {
    const settings = claudeApiKeyProfileSettings(
      { env: { ANTHROPIC_CUSTOM_HEADERS: 'anthropic-workspace-id: wrkspc_previous' } },
      { apiKey: 'test-key', config: { baseUrl: 'https://api.anthropic.com', workspaceId } }
    )
    expect(settings).toMatchObject({
      env: { ANTHROPIC_CUSTOM_HEADERS: workspaceId ? `anthropic-workspace-id: ${workspaceId}` : '' }
    })
  }
)
