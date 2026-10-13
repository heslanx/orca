import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import {
  createSettings,
  createStore,
  createRateLimits,
  createRuntimeHome,
  registerCodexAccountsTestHomes,
  testState
} from './service-test-harness'
import type { Store } from '../persistence'
import type { RateLimitService } from '../rate-limits/service'
import type { CodexRuntimeHomeService } from './runtime-home-service'

vi.mock('electron', () => ({ app: { getPath: () => testState.userDataDir } }))
vi.mock('node:os', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  homedir: () => testState.fakeHomeDir
}))
registerCodexAccountsTestHomes()

it('adds, edits, selects and removes BYOK without OAuth and keeps credentials out of metadata', async () => {
  const { CodexAccountService } = await import('./service')
  const store = createStore(createSettings())
  const rates = createRateLimits(),
    runtime = createRuntimeHome()
  const service = new CodexAccountService(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The fixture implements the persistence surface used by account enrollment.
    store as unknown as Store,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Only account cache/refresh methods are used by this lifecycle.
    rates as unknown as RateLimitService,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Account selection uses only the runtime-home synchronization methods supplied here.
    runtime as unknown as CodexRuntimeHomeService
  )
  writeFileSync(join(testState.fakeHomeDir, '.codex', 'config.toml'), 'model = "old-model"\n')
  const state = await service.addApiKeyAccount({
    label: 'API test',
    apiKey: 'test-first-key',
    config: { model: 'test-model', projectId: 'proj_test' }
  })
  const id = state.accounts[0].id
  expect(state.activeAccountId).toBeNull()
  expect(state.accounts[0]).toMatchObject({
    authMethod: 'api-key',
    apiKeyConfig: { model: 'test-model' }
  })
  expect(JSON.stringify(store.getSettings())).not.toContain('test-first-key')
  await service.selectAccount(id)
  expect(service.listAccounts().activeAccountId).toBe(id)
  await service.updateApiKeyAccount({
    accountId: id,
    label: 'Renamed',
    apiKey: 'test-rotated-key',
    config: { projectId: '' }
  })
  const saved = store.getSettings().codexManagedAccounts[0]
  expect(saved.email).toBe('Renamed')
  expect(saved.apiKeyConfig).toMatchObject({ model: 'test-model', projectId: '' })
  expect(readFileSync(join(saved.managedHomePath, 'auth.json'), 'utf8')).toContain(
    'test-rotated-key'
  )
  expect(readFileSync(join(testState.fakeHomeDir, '.codex', 'config.toml'), 'utf8')).toBe(
    'model = "old-model"\n'
  )
  await expect(service.reauthenticateAccount(id)).rejects.toThrow('Edit this API account')
  await service.removeAccount(id)
  expect(service.listAccounts().accounts).toEqual([])
  expect(existsSync(saved.managedHomePath)).toBe(false)
})
