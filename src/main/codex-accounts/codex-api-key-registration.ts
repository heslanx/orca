import { randomUUID } from 'node:crypto'
import {
  CodexApiKeyAccountInputSchema,
  CodexApiKeyAccountUpdateSchema
} from '../../shared/codex-api-key-account'
import type { CodexAccountRegistrationDependencies } from './codex-account-registration'
import { readCodexApiKeyProfile, saveCodexApiKeyProfile } from './codex-api-key-profile'

export async function registerCodexApiKeyAccount(
  input: unknown,
  deps: CodexAccountRegistrationDependencies
) {
  const result = CodexApiKeyAccountInputSchema.safeParse(input)
  if (!result.success || result.data.runtime === 'wsl') {
    throw new Error('Provide a valid native Codex API account.')
  }
  const { label, apiKey, config } = result.data
  const id = randomUUID()
  const folder = await deps.managedHomes.create(id, { runtime: 'host' })
  const previous = deps.store.getSettings().codexManagedAccounts
  try {
    const canonical = deps.configMirror.readForManagedHome(folder.managedHomePath)
    saveCodexApiKeyProfile(folder.managedHomePath, { apiKey, config }, canonical?.contents ?? '')
    const now = Date.now()
    deps.store.updateSettings({
      codexManagedAccounts: [
        ...previous,
        {
          id,
          email: label,
          ...folder,
          authMethod: 'api-key',
          apiKeyConfig: config,
          createdAt: now,
          updatedAt: now,
          lastAuthenticatedAt: now
        }
      ]
    })
    return deps.selection.snapshot()
  } catch {
    deps.store.updateSettings({ codexManagedAccounts: previous })
    deps.managedHomes.safeRemove(folder.managedHomePath, id)
    throw new Error('Could not save the Codex API account. Check credential storage and try again.')
  }
}

export async function updateCodexApiKeyAccount(
  input: unknown,
  deps: CodexAccountRegistrationDependencies
) {
  const result = CodexApiKeyAccountUpdateSchema.safeParse(input)
  if (!result.success) {
    throw new Error('Provide an account ID and valid account changes.')
  }
  const patch = result.data
  const account = deps.selection.requireAccount(patch.accountId)
  if (account.authMethod !== 'api-key' || account.managedHomeRuntime === 'wsl') {
    throw new Error('Only native Codex API accounts can be edited.')
  }
  const home = deps.managedHomePaths.assert(account.managedHomePath, account.id)
  const previous = readCodexApiKeyProfile(home)
  if (!previous) {
    throw new Error('This Codex API account has no key. Add it again.')
  }
  const accounts = deps.store.getSettings().codexManagedAccounts
  const config = { ...previous.config }
  for (const [key, value] of Object.entries(patch.config ?? {})) {
    if (value !== undefined) {
      Object.assign(config, { [key]: value })
    }
  }
  try {
    saveCodexApiKeyProfile(home, { apiKey: patch.apiKey ?? previous.apiKey, config })
    deps.store.updateSettings({
      codexManagedAccounts: accounts.map((entry) =>
        entry.id === account.id
          ? {
              ...entry,
              email: patch.label ?? entry.email,
              apiKeyConfig: config,
              updatedAt: Date.now(),
              ...(patch.apiKey ? { lastAuthenticatedAt: Date.now() } : {})
            }
          : entry
      )
    })
  } catch {
    saveCodexApiKeyProfile(home, previous)
    deps.store.updateSettings({ codexManagedAccounts: accounts })
    throw new Error(
      'Could not update the Codex API account. The previous configuration was restored.'
    )
  }
  deps.rateLimits.evictInactiveCodexCache(account.id)
  return deps.selection.snapshot()
}
