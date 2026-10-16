export const CODEX_RESET_CREDIT_RUNTIME_CAPABILITY = 'accounts.codex-reset-credit.v1' as const
export const ANTIGRAVITY_ACCOUNTS_RUNTIME_CAPABILITY = 'accounts.antigravity-native.v1' as const
export const DATA_ACCOUNT_RUNTIME_CAPABILITY = 'accounts.managed-data-profiles.v1' as const
export const ACCOUNT_IMPORT_RUNTIME_CAPABILITY = 'accounts.import-host-credentials.v1' as const
// Why: sign-in runs in an account folder the host creates first.
export const CLAUDE_SIGN_IN_RUNTIME_CAPABILITY = 'accounts.claude-sign-in.v1' as const
export const CLAUDE_API_KEY_RUNTIME_CAPABILITY = 'accounts.claude-api-key.v1' as const
export const CLAUDE_API_KEY_EDIT_RUNTIME_CAPABILITY = 'accounts.claude-api-key-edit.v1' as const
export const CLAUDE_API_KEY_WORKSPACE_RUNTIME_CAPABILITY =
  'accounts.claude-api-key-workspace.v1' as const

export const CODEX_API_KEY_RUNTIME_CAPABILITY = 'accounts.codex-api-key.v1' as const
export const API_ACCOUNT_TEST_RUNTIME_CAPABILITY = 'accounts.api-key-test.v1' as const

export const ACCOUNT_RUNTIME_CAPABILITIES = [
  CODEX_RESET_CREDIT_RUNTIME_CAPABILITY,
  ANTIGRAVITY_ACCOUNTS_RUNTIME_CAPABILITY,
  DATA_ACCOUNT_RUNTIME_CAPABILITY,
  ACCOUNT_IMPORT_RUNTIME_CAPABILITY,
  CODEX_API_KEY_RUNTIME_CAPABILITY,
  API_ACCOUNT_TEST_RUNTIME_CAPABILITY,
  CLAUDE_SIGN_IN_RUNTIME_CAPABILITY,
  CLAUDE_API_KEY_RUNTIME_CAPABILITY,
  CLAUDE_API_KEY_EDIT_RUNTIME_CAPABILITY,
  CLAUDE_API_KEY_WORKSPACE_RUNTIME_CAPABILITY
] as const
