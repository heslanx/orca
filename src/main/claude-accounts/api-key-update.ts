import { ClaudeApiKeyAccountUpdateSchema } from '../../shared/claude-api-key-account'
import type { ClaudeAccountRegistrationDependencies } from './claude-account-registration'
import { readClaudeApiKeyProfile, saveClaudeApiKeyProfile } from './claude-api-key-profile'

export async function updateClaudeApiKeyAccount(
  input: unknown,
  deps: ClaudeAccountRegistrationDependencies
) {
  const parsed = ClaudeApiKeyAccountUpdateSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error('Provide an account ID and valid account changes.')
  }
  const patch = parsed.data
  const saved = deps.selection.requireAccount(patch.accountId)
  if (saved.authMethod !== 'api-key' || saved.managedAuthRuntime === 'wsl') {
    throw new Error('Only native Claude API accounts can be edited.')
  }
  const target = { runtime: 'host' } as const
  const folder = await deps.runtimeAuth.prepareAccountFolder(saved.id, target)
  const previous = readClaudeApiKeyProfile(folder.readPath)
  if (!previous) {
    throw new Error('This Claude API account has no key. Remove it and add it again.')
  }
  const previousAccounts = deps.store.getSettings().claudeManagedAccounts
  const config = { ...previous.config }
  for (const [key, value] of Object.entries(patch.config ?? {})) {
    if (value !== undefined) {
      Object.assign(config, { [key]: value })
    }
  }
  try {
    saveClaudeApiKeyProfile(folder.readPath, { apiKey: patch.apiKey ?? previous.apiKey, config })
    deps.selection.saveSettings({
      claudeManagedAccounts: previousAccounts.map((account) =>
        account.id === saved.id
          ? {
              ...account,
              email: patch.label ?? account.email,
              apiKeyConfig: config,
              updatedAt: Date.now(),
              ...(patch.apiKey ? { lastAuthenticatedAt: Date.now() } : {})
            }
          : account
      )
    })
    await deps.runtimeAuth.syncForCurrentSelection(target)
  } catch {
    try {
      saveClaudeApiKeyProfile(folder.readPath, previous)
      deps.selection.saveSettings({ claudeManagedAccounts: previousAccounts })
      await deps.runtimeAuth.syncForCurrentSelection(target)
    } catch {
      throw new Error(
        'Could not restore the API account after an update failure. Remove it and add it again.'
      )
    }
    throw new Error(
      'Could not update the Claude API account. The previous configuration was restored.'
    )
  }
  deps.rateLimits.evictInactiveClaudeCache(saved.id)
  return deps.selection.list()
}
