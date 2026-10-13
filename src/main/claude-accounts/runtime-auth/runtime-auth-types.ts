import type { ClaudeEnvPatch } from '../environment'

export type ClaudeRuntimeAuthPreparation = {
  configDir: string
  runtime?: 'host' | 'wsl'
  wslDistro?: string | null
  wslLinuxConfigDir?: string | null
  envPatch: ClaudeEnvPatch
  provenance: string
  authMethod?: 'subscription-oauth' | 'api-key' | 'unknown'
  /** Usage only: why the selected account cannot be read; usage polling must not throw for it. */
  usageError?: string
}
