import { lstatSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { ClaudeApiKeyAccountInputSchema } from '../../shared/claude-api-key-account'
import { isDefinitiveAbsence } from '../../shared/definitive-filesystem-absence'
import { writeSecureFile } from '../../shared/secure-file'
import { readClaudeProfileObject, type ClaudeProfileDescriptor } from './claude-profile-paths'
import type { ClaudeProfileSetupReport } from './claude-profile-setup'
import type { GlobalSettings } from '../../shared/global-settings-types'

export function validateClaudeApiKeySelection(
  profile: ClaudeProfileDescriptor | null,
  settings: Pick<GlobalSettings, 'claudeManagedAccounts'>
): boolean {
  if (
    !profile ||
    !settings.claudeManagedAccounts.some(
      (account) => account.id === profile.accountId && account.authMethod === 'api-key'
    )
  ) {
    return false
  }
  if (!readClaudeApiKeyProfile(profile.home)) {
    throw new Error('This Claude API account has no key. Remove it and add it again.')
  }
  return true
}

export function claudeApiKeySetupFailed(
  report: ClaudeProfileSetupReport | null,
  isApiKey: boolean
): boolean {
  return (
    report?.outcome !== 'prepared' || (isApiKey && report.surfaces['settings.json'] === 'failed')
  )
}

/** Private to the account folder; never part of Orca settings or account summaries. */
const API_ACCOUNT_FILE = '.orca-api-account.json'
const ApiAccountSchema = ClaudeApiKeyAccountInputSchema.pick({ apiKey: true, config: true })
type ApiAccount = z.infer<typeof ApiAccountSchema>

export function saveClaudeApiKeyProfile(home: string, value: ApiAccount): void {
  const parsed = ApiAccountSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error('Invalid Claude API account configuration.')
  }
  const file = join(home, API_ACCOUNT_FILE)
  if (!writeSecureFile(file, JSON.stringify(parsed.data), { durable: true })) {
    rmSync(file, { force: true })
    throw new Error('Could not restrict access to the Claude API key file.')
  }
  const settings = readClaudeProfileObject(join(home, 'settings.json'))
  if (settings.kind === 'unavailable') {
    throw new Error('Claude profile settings are unreadable.')
  }
  publishClaudeApiKeySettings(
    home,
    claudeApiKeyProfileSettings(settings.kind === 'present' ? settings.value : {}, parsed.data)
  )
}

export function readClaudeApiKeyProfile(home: string): ApiAccount | null {
  const file = join(home, API_ACCOUNT_FILE)
  try {
    if (!lstatSync(file).isFile()) {
      throw new Error('Invalid API account file.')
    }
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
    const parsed = ApiAccountSchema.safeParse(value)
    if (parsed.success) {
      return parsed.data
    }
  } catch (error) {
    if (isDefinitiveAbsence(error)) {
      return null
    }
  }
  throw new Error('The Claude API account is unreadable. Remove it and add it again.')
}

/** Reapplied after every profile refresh; inherited gateway credentials cannot replace this key. */
export function claudeApiKeyProfileSettings(
  source: Record<string, unknown>,
  account: ApiAccount
): Record<string, unknown> {
  const inheritedEnv = z.record(z.string(), z.unknown()).safeParse(source.env)
  const config = account.config
  const settings = { ...source }
  delete settings.apiKeyHelper
  delete settings.forceLoginMethod
  delete settings.forceLoginOrgUUID
  delete settings.model
  return {
    ...settings,
    ...(config.model ? { model: config.model } : {}),
    env: {
      ...(inheritedEnv.success ? inheritedEnv.data : {}),
      ANTHROPIC_AUTH_TOKEN: '',
      CLAUDE_CODE_OAUTH_TOKEN: '',
      CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR: '',
      AWS_BEARER_TOKEN_BEDROCK: '',
      ANTHROPIC_CUSTOM_HEADERS: config.workspaceId
        ? `anthropic-workspace-id: ${config.workspaceId}`
        : '',
      CLAUDE_CODE_USE_BEDROCK: '0',
      CLAUDE_CODE_USE_VERTEX: '0',
      CLAUDE_CODE_USE_FOUNDRY: '0',
      CLAUDE_CODE_USE_ANTHROPIC_AWS: '0',
      ANTHROPIC_API_KEY: account.apiKey,
      ANTHROPIC_BASE_URL: config.baseUrl,
      ANTHROPIC_MODEL: config.model ?? '',
      ANTHROPIC_DEFAULT_OPUS_MODEL: config.opusModel ?? '',
      ANTHROPIC_DEFAULT_SONNET_MODEL: config.sonnetModel ?? '',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: config.haikuModel ?? ''
    }
  }
}

export function publishClaudeApiKeySettings(home: string, settings: Record<string, unknown>): void {
  const target = join(home, 'settings.json')
  if (!writeSecureFile(target, `${JSON.stringify(settings, null, 2)}\n`, { durable: true })) {
    rmSync(target, { force: true })
    throw new Error('Could not restrict access to the Claude API account settings.')
  }
}
