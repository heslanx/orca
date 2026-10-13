import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify, type TomlTable } from 'smol-toml'
import { CodexApiKeyAccountInputSchema } from '../../shared/codex-api-key-account'
import { writeSecureFile } from '../../shared/secure-file'
import { isDefinitiveAbsence } from '../../shared/definitive-filesystem-absence'
import { applyCodexDaemonSocketGuard } from '../codex/codex-daemon-socket-path-guard'

const ProfileSchema = CodexApiKeyAccountInputSchema.pick({ apiKey: true, config: true })
const profileName = '.orca-api-account.json'
export function hasCodexApiKeyProfile(home: string): boolean {
  return existsSync(join(home, profileName))
}
type Profile = ReturnType<typeof ProfileSchema.parse>

export function readCodexApiKeyProfile(home: string): Profile | null {
  try {
    const value: unknown = JSON.parse(readFileSync(join(home, profileName), 'utf8'))
    const parsed = ProfileSchema.safeParse(value)
    if (parsed.success) {
      return parsed.data
    }
  } catch (error) {
    if (isDefinitiveAbsence(error)) {
      return null
    }
  }
  throw new Error('The Codex API account is unreadable. Edit the account or add it again.')
}

function secureWrite(home: string, name: string, value: string): void {
  if (!writeSecureFile(join(home, name), value, { durable: true })) {
    throw new Error('Could not restrict access to the Codex API account.')
  }
}

export function saveCodexApiKeyProfile(home: string, input: Profile, initialConfig?: string): void {
  const result = ProfileSchema.safeParse(input)
  if (!result.success) {
    throw new Error('Invalid Codex API account configuration.')
  }
  const account = result.data
  let source = initialConfig
  if (source === undefined) {
    try {
      source = readFileSync(join(home, 'config.toml'), 'utf8')
    } catch (error) {
      if (!isDefinitiveAbsence(error)) {
        throw new Error('The Codex account settings are unreadable.')
      }
    }
  }
  let settings: TomlTable
  try {
    settings = parse(source ?? '')
  } catch {
    throw new Error('The Codex account settings are invalid.')
  }
  for (const key of [
    'profile',
    'profiles',
    'model_providers',
    'openai_base_url',
    'chatgpt_base_url',
    'forced_login_method',
    'forced_chatgpt_workspace_id'
  ]) {
    delete settings[key]
  }
  const headers: Record<string, string> = {}
  if (account.config.organizationId) {
    headers['OpenAI-Organization'] = account.config.organizationId
  }
  if (account.config.projectId) {
    headers['OpenAI-Project'] = account.config.projectId
  }
  settings.model = account.config.model
  settings.model_provider = 'orca-byok'
  settings.cli_auth_credentials_store = 'file'
  settings.model_providers = {
    'orca-byok': {
      name: 'Orca API account',
      base_url: account.config.baseUrl,
      wire_api: 'responses',
      requires_openai_auth: false,
      experimental_bearer_token: account.apiKey,
      http_headers: headers
    }
  }
  secureWrite(home, profileName, JSON.stringify(account))
  secureWrite(
    home,
    'auth.json',
    JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: account.apiKey })
  )
  secureWrite(home, 'config.toml', applyCodexDaemonSocketGuard(stringify(settings), home))
}

/** BYOK preferences stay local so credentials can never be promoted into the system config. */
export function refreshCodexApiKeyProfile(home: string): boolean {
  const account = readCodexApiKeyProfile(home)
  if (!account) {
    return false
  }
  saveCodexApiKeyProfile(home, account)
  return true
}
