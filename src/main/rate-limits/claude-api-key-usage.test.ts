import { expect, it, vi } from 'vitest'
import { fetchActiveClaudeRateLimits } from './claude-active-usage-fetch'
import { readClaudeOAuthCredentials } from './claude-oauth-credentials'
import { fetchClaudeOAuthUsage } from './claude-oauth-usage-request'

vi.mock('./claude-oauth-usage-request', () => ({ fetchClaudeOAuthUsage: vi.fn() }))

vi.mock('./claude-oauth-credentials', () => ({
  readClaudeOAuthCredentials: vi.fn(),
  resolveClaudeOAuthCredentialReadOptions: vi.fn()
}))

it('does not probe OAuth credentials or subscription quotas for API accounts', async () => {
  const result = await fetchActiveClaudeRateLimits({
    authPreparation: {
      configDir: '/test/profile',
      envPatch: {},
      provenance: 'profile:test',
      authMethod: 'api-key'
    }
  })
  expect(result).toMatchObject({
    status: 'unavailable',
    usageMetadata: { failureKind: 'no-subscription', attemptedSources: [] }
  })
  expect(readClaudeOAuthCredentials).not.toHaveBeenCalled()
  expect(fetchClaudeOAuthUsage).not.toHaveBeenCalled()
})
