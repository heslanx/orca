import { randomUUID } from 'node:crypto'
import { ClaudeApiKeyAccountInputSchema } from '../../shared/claude-api-key-account'
import type { ClaudeAccountRegistrationDependencies } from './claude-account-registration'
import { saveClaudeApiKeyProfile } from './claude-api-key-profile'

export async function registerClaudeApiKeyAccount(
  input: unknown,
  deps: ClaudeAccountRegistrationDependencies
) {
  const parsed = ClaudeApiKeyAccountInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error('Enter a name, a valid API key, and a valid API URL and model configuration.')
  }
  if (parsed.data.runtime === 'wsl') {
    throw new Error(
      'Add Claude API accounts on the native execution host. WSL API accounts are not supported yet.'
    )
  }
  const { label, apiKey, config } = parsed.data
  const accountId = randomUUID()
  const target = { runtime: 'host' } as const
  const previous = deps.store.getSettings()
  try {
    const folder = await deps.runtimeAuth.prepareAccountFolder(accountId, target)
    saveClaudeApiKeyProfile(folder.readPath, { apiKey, config })
    const now = Date.now()
    deps.selection.saveSettings({
      claudeManagedAccounts: [
        ...previous.claudeManagedAccounts,
        {
          id: accountId,
          email: label,
          managedAuthPath: folder.readPath,
          managedAuthRuntime: 'host',
          authMethod: 'api-key',
          apiKeyConfig: config,
          createdAt: now,
          updatedAt: now,
          lastAuthenticatedAt: now
        }
      ]
    })
    await deps.runtimeAuth.syncForCurrentSelection(target)
    return deps.selection.list()
  } catch {
    try {
      deps.selection.saveSettings({ claudeManagedAccounts: previous.claudeManagedAccounts })
    } finally {
      await deps.runtimeAuth.removeAccountFolder(accountId, target).catch(() => {})
    }
    throw new Error(
      'Could not save the Claude API account. Check credential storage and try again.'
    )
  }
}
