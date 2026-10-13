import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../shared/constants'
import { createEmptyRateLimitState } from '../../shared/rate-limit-state-factory'
import { ClaudeApiKeyAccountInputSchema } from '../../shared/claude-api-key-account'
import { ClaudeAccountService } from './service'
import { ClaudeProfileRouter } from './claude-profile-router'
import { provisionClaudeAccountProfile } from './claude-profile-setup'
import { readClaudeApiKeyProfile } from './claude-api-key-profile'

vi.mock('../macos-keychain/generic-password', () => ({
  execSecurityCommand: async () => {
    throw new Error('The specified item could not be found in the keychain.')
  }
}))

const roots: string[] = []
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })))
const input = {
  label: 'Test gateway',
  apiKey: 'test-key-never-a-real-credential',
  runtime: 'host',
  config: {
    baseUrl: 'https://gateway.example.test',
    model: 'proxy-model',
    opusModel: 'proxy-opus',
    sonnetModel: 'proxy-sonnet',
    haikuModel: 'proxy-haiku'
  }
}

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'orca-byok-'))
  roots.push(root)
  const userHome = join(root, 'personal')
  const defaultHome = join(userHome, '.claude')
  mkdirSync(defaultHome, { recursive: true })
  writeFileSync(
    join(defaultHome, 'settings.json'),
    JSON.stringify({
      permissions: { allow: ['Read'] },
      theme: 'dark',
      apiKeyHelper: 'old-helper',
      env: {
        CUSTOM_OPTION: 'preserved',
        ANTHROPIC_AUTH_TOKEN: 'unrelated-token',
        CLAUDE_CODE_USE_BEDROCK: '1'
      }
    })
  )
  let settings = { ...getDefaultSettings(userHome), agentStatusHooksEnabled: false }
  const router = new ClaudeProfileRouter({
    dataRoot: join(root, 'data'),
    userHome,
    env: { CLAUDE_CONFIG_DIR: defaultHome },
    getSettings: () => settings,
    runSetup: (job) => provisionClaudeAccountProfile({ ...job, installHooks: null })
  })
  const runtime = {
    router,
    prepareAccountFolder: async (id: string) => {
      const home = await router.prepareAccount(id)
      return { configDir: home, readPath: home }
    },
    removeAccountFolder: (id: string) => router.removeAccount(id),
    syncForCurrentSelection: vi.fn(async () => {
      router.publish()
    }),
    publishAll: async () => {
      router.publish()
    },
    getRuntimeConfigDir: () => defaultHome
  }
  const login = vi.fn(async () => '')
  let failSave = false
  const service = new ClaudeAccountService(
    {
      getSettings: () => settings,
      updateSettings: (patch) => {
        if (failSave) {
          failSave = false
          throw new Error('Test save failure')
        }
        settings = { ...settings, ...patch }
      }
    },
    {
      evictInactiveClaudeCache: vi.fn(),
      refreshForClaudeAccountChange: vi.fn(async () => createEmptyRateLimitState())
    },
    runtime,
    login
  )
  const oauthHome = await router.prepareAccount('oauth')
  writeFileSync(
    join(oauthHome, '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'oauth@example.test' } })
  )
  settings.claudeManagedAccounts = [
    {
      id: 'oauth',
      email: 'oauth@example.test',
      managedAuthPath: oauthHome,
      managedAuthRuntime: 'host',
      authMethod: 'subscription-oauth',
      createdAt: 1,
      updatedAt: 1,
      lastAuthenticatedAt: 1
    }
  ]
  settings.activeClaudeManagedAccountId = 'oauth'
  settings.activeClaudeManagedAccountIdsByRuntime = { host: 'oauth', wsl: {} }
  return {
    root,
    router,
    service,
    login,
    runtime,
    defaultHome,
    oauthHome,
    settings: () => settings,
    failSave: () => {
      failSave = true
    }
  }
}

describe('Claude API accounts', () => {
  it('adds privately, switches both directions, refreshes settings and removes only its own folder', async () => {
    const f = await fixture()
    const systemSettings = readFileSync(join(f.defaultHome, 'settings.json'), 'utf8')
    const oauthLogin = readFileSync(join(f.oauthHome, '.claude.json'), 'utf8')
    const added = await f.service.addApiKeyAccount(input)
    const api = added.accounts.find((account) => account.authMethod === 'api-key')
    expect(api).toBeDefined()
    if (!api) {
      throw new Error('Missing API account')
    }
    const apiHome = f.router.accountHome(api.id)
    expect(added.activeAccountId).toBe('oauth')
    expect(api).not.toHaveProperty('needsSignIn')
    expect(JSON.stringify([added, f.settings()])).not.toContain(input.apiKey)
    expect(f.login).not.toHaveBeenCalled()
    expect(statSync(join(apiHome, 'settings.json')).mode & 0o777).toBe(0o600)
    expect(statSync(join(apiHome, '.orca-api-account.json')).mode & 0o777).toBe(0o600)

    await f.service.selectAccount(api.id)
    const prepared = await f.router.prepareLaunch()
    expect(prepared.envPatch.CLAUDE_CONFIG_DIR).toBe(apiHome)
    expect(prepared.authMethod).toBe('api-key')
    expect(readFileSync(f.router.pointerPath, 'utf8')).toBe(apiHome)
    const config = JSON.parse(readFileSync(join(apiHome, 'settings.json'), 'utf8'))
    expect(config).toMatchObject({
      permissions: { allow: ['Read'] },
      model: 'proxy-model',
      env: {
        ANTHROPIC_API_KEY: input.apiKey,
        ANTHROPIC_BASE_URL: input.config.baseUrl,
        ANTHROPIC_AUTH_TOKEN: '',
        CLAUDE_CODE_USE_BEDROCK: '0',
        CUSTOM_OPTION: 'preserved',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'proxy-opus',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'proxy-sonnet',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'proxy-haiku'
      }
    })
    expect(config).not.toHaveProperty('apiKeyHelper')
    await expect(f.service.reauthenticateAccount(api.id)).rejects.toThrow('remove this account')

    await f.service.selectAccount('oauth')
    expect((await f.router.prepareLaunch()).envPatch.CLAUDE_CONFIG_DIR).toBe(f.oauthHome)
    expect(readFileSync(join(f.oauthHome, '.claude.json'), 'utf8')).toBe(oauthLogin)
    expect(readFileSync(join(f.oauthHome, 'settings.json'), 'utf8')).not.toContain(input.apiKey)
    await f.service.selectAccount(null)
    expect((await f.router.prepareLaunch()).envPatch.CLAUDE_CONFIG_DIR).toBeUndefined()
    expect(readFileSync(join(f.defaultHome, 'settings.json'), 'utf8')).toBe(systemSettings)
    await f.service.removeAccount(api.id)
    expect(existsSync(apiHome)).toBe(false)
    expect(existsSync(f.oauthHome)).toBe(true)
  })

  it('fails closed when a selected key is missing or corrupt', async () => {
    const f = await fixture()
    const added = await f.service.addApiKeyAccount(input)
    const api = added.accounts.find((account) => account.authMethod === 'api-key')!
    await f.service.selectAccount(api.id)
    await f.router.prepareLaunch()
    const file = join(f.router.accountHome(api.id), '.orca-api-account.json')
    writeFileSync(file, '{broken')
    expect(() => readClaudeApiKeyProfile(f.router.accountHome(api.id))).toThrow('unreadable')
    await expect(f.router.prepareLaunch()).rejects.toThrow('unreadable')
    rmSync(file)
    await expect(f.router.prepareLaunch()).rejects.toThrow('no key')
  })

  it('rejects invalid endpoints and WSL before creating a folder', async () => {
    const f = await fixture()
    for (const baseUrl of [
      'http://external.test',
      'https://user:password@example.test',
      'https://example.test?key=secret',
      'file:///tmp/a'
    ]) {
      await expect(f.service.addApiKeyAccount({ ...input, config: { baseUrl } })).rejects.toThrow(
        'valid API'
      )
    }
    await expect(
      f.service.addApiKeyAccount({ ...input, runtime: 'wsl', wslDistro: 'Ubuntu' })
    ).rejects.toThrow('WSL')
    expect(f.service.listAccounts().accounts).toHaveLength(1)
    expect(
      ClaudeApiKeyAccountInputSchema.safeParse({
        ...input,
        config: { baseUrl: 'http://127.0.0.1:3456' }
      }).success
    ).toBe(true)
  })

  it('rolls back account metadata when saving fails', async () => {
    const f = await fixture()
    f.failSave()
    await expect(f.service.addApiKeyAccount(input)).rejects.toThrow('Could not save')
    expect(f.service.listAccounts().accounts).toHaveLength(1)
    expect(f.service.listAccounts().activeAccountId).toBe('oauth')
  })

  it('edits and rotates an active API account without replacing its identity or history', async () => {
    const f = await fixture()
    const added = await f.service.addApiKeyAccount(input)
    const api = added.accounts.find((account) => account.authMethod === 'api-key')!
    await f.service.selectAccount(api.id)
    const home = f.router.accountHome(api.id)
    writeFileSync(join(home, 'local-note.txt'), 'Keep account data')
    const renamed = await f.service.updateApiKeyAccount({ accountId: api.id, label: 'Renamed' })
    expect(renamed.accounts.find((account) => account.id === api.id)?.apiKeyConfig).toEqual(
      input.config
    )
    expect(readClaudeApiKeyProfile(home)?.apiKey).toBe(input.apiKey)
    const updated = await f.service.updateApiKeyAccount({
      accountId: api.id,
      apiKey: 'test-rotated-key',
      config: { baseUrl: 'https://new.example.test', model: '', opusModel: 'new-opus' }
    })
    expect(updated.activeAccountId).toBe(api.id)
    expect(updated.accounts.find((account) => account.id === api.id)).toMatchObject({
      email: 'Renamed',
      createdAt: api.createdAt,
      apiKeyConfig: { model: '', opusModel: 'new-opus', sonnetModel: input.config.sonnetModel }
    })
    await f.router.prepareLaunch()
    const native = JSON.parse(readFileSync(join(home, 'settings.json'), 'utf8'))
    expect(native.env.ANTHROPIC_API_KEY).toBe('test-rotated-key')
    expect(native.env.ANTHROPIC_BASE_URL).toBe('https://new.example.test')
    expect(native).not.toHaveProperty('model')
    expect(JSON.stringify([updated, f.settings()])).not.toContain('test-rotated-key')
    expect(readFileSync(join(home, 'local-note.txt'), 'utf8')).toBe('Keep account data')
    expect(statSync(join(home, 'settings.json')).mode & 0o777).toBe(0o600)
  })

  it('restores the prior key, settings and metadata if an edit cannot be saved', async () => {
    const f = await fixture()
    const added = await f.service.addApiKeyAccount(input)
    const api = added.accounts.find((account) => account.authMethod === 'api-key')!
    const home = f.router.accountHome(api.id)
    f.failSave()
    await expect(
      f.service.updateApiKeyAccount({
        accountId: api.id,
        label: 'Failed rename',
        apiKey: 'test-unsaved-key',
        config: { model: 'bad-save' }
      })
    ).rejects.toThrow('previous configuration was restored')
    expect(readClaudeApiKeyProfile(home)).toEqual({ apiKey: input.apiKey, config: input.config })
    expect(f.service.listAccounts().accounts.find((account) => account.id === api.id)).toEqual(api)
    expect(readFileSync(join(home, 'settings.json'), 'utf8')).not.toContain('test-unsaved-key')
    await expect(
      f.service.updateApiKeyAccount({ accountId: 'oauth', label: 'Wrong type' })
    ).rejects.toThrow('Only native')
    await expect(f.service.updateApiKeyAccount({ accountId: api.id })).rejects.toThrow(
      'valid account changes'
    )
  })
})
