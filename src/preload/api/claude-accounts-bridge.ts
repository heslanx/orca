import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import type { ApiAccountConnectionInput } from '../../shared/api-account-connection'
import type { ClaudeApiKeyAccountInput } from '../../shared/claude-api-key-account'

export const claudeAccountsApi = {
  testApiKey: (args: ApiAccountConnectionInput) =>
    ipcRenderer.invoke('claudeAccounts:testApiKey', args),
  list: () => ipcRenderer.invoke('claudeAccounts:list'),
  addApiKey: (args: ClaudeApiKeyAccountInput) =>
    ipcRenderer.invoke('claudeAccounts:addApiKey', args),
  add: (args?: { runtime?: 'host' | 'wsl'; wslDistro?: string | null; copyLink?: boolean }) =>
    ipcRenderer.invoke('claudeAccounts:add', args),
  cancelPendingLogin: (): Promise<boolean> =>
    ipcRenderer.invoke('claudeAccounts:cancelPendingLogin'),
  reauthenticate: (args: { accountId: string; copyLink?: boolean }) =>
    ipcRenderer.invoke('claudeAccounts:reauthenticate', args),
  waitForSignInLink: (): Promise<string | null> =>
    ipcRenderer.invoke('claudeAccounts:waitForSignInLink'),
  remove: (args: { accountId: string }) => ipcRenderer.invoke('claudeAccounts:remove', args),
  select: (args: {
    accountId: string | null
    runtime?: 'host' | 'wsl'
    wslDistro?: string | null
  }) => ipcRenderer.invoke('claudeAccounts:select', args)
} satisfies PreloadApi['claudeAccounts']
