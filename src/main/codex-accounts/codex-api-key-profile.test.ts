import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { parse } from 'smol-toml'
import { saveCodexApiKeyProfile, readCodexApiKeyProfile } from './codex-api-key-profile'
import { syncSystemConfigIntoManagedCodexHome } from '../codex/codex-config-mirror'

const roots: string[] = []
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })))
function folder() {
  const path = mkdtempSync(join(tmpdir(), 'orca-codex-api-test-'))
  roots.push(path)
  return path
}

it('keeps API credentials private and never promotes them into the system configuration', () => {
  const home = folder(),
    system = folder()
  const source =
    'model_provider = "old-provider"\nmodel = "old-model"\n[projects."/work"]\ntrust_level = "trusted"\n'
  writeFileSync(join(system, 'config.toml'), source)
  saveCodexApiKeyProfile(
    home,
    {
      apiKey: 'test-first-key',
      config: {
        baseUrl: 'https://gateway.example/v1',
        model: 'test-model',
        projectId: 'proj_first'
      }
    },
    source
  )
  syncSystemConfigIntoManagedCodexHome({ runtimeHomePath: home, systemHomePath: system })
  expect(readFileSync(join(system, 'config.toml'), 'utf8')).toBe(source)
  const config = parse(readFileSync(join(home, 'config.toml'), 'utf8'))
  expect(config).toMatchObject({
    model: 'test-model',
    model_provider: 'orca-byok',
    projects: { '/work': { trust_level: 'trusted' } },
    model_providers: {
      'orca-byok': {
        experimental_bearer_token: 'test-first-key',
        http_headers: { 'OpenAI-Project': 'proj_first' }
      }
    }
  })
  for (const name of ['auth.json', 'config.toml', '.orca-api-account.json']) {
    if (process.platform !== 'win32') {
      expect(statSync(join(home, name)).mode & 0o777).toBe(0o600)
    }
  }
  saveCodexApiKeyProfile(home, {
    apiKey: 'test-rotated-key',
    config: { baseUrl: 'https://other.example/v1', model: 'new-model', projectId: '' }
  })
  expect(readCodexApiKeyProfile(home)?.apiKey).toBe('test-rotated-key')
  expect(readFileSync(join(home, 'config.toml'), 'utf8')).not.toContain('proj_first')
})

it('fails closed on corrupt account credentials instead of mirroring another account configuration', () => {
  const home = folder(),
    system = folder()
  writeFileSync(join(home, '.orca-api-account.json'), 'corrupt')
  writeFileSync(join(home, 'config.toml'), 'model = "keep"')
  expect(() =>
    syncSystemConfigIntoManagedCodexHome({ runtimeHomePath: home, systemHomePath: system })
  ).toThrow('unreadable')
  expect(readFileSync(join(home, 'config.toml'), 'utf8')).toBe('model = "keep"')
})
