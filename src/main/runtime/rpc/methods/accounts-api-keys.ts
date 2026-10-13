import { defineMethod } from '../core'
import {
  AddClaudeApiKeyParams,
  UpdateClaudeApiKeyParams,
  AddCodexApiKeyParams,
  UpdateCodexApiKeyParams,
  TestApiAccountParams
} from '../../../../shared/rpc-contract/accounts-params'
import { testApiAccountConnection } from '../../../api-account-connection'

export const API_KEY_ACCOUNT_METHODS = [
  defineMethod({
    name: 'accounts.updateClaudeApiKey',
    permission: 'accounts-admin',
    params: UpdateClaudeApiKeyParams,
    handler: async (params, { runtime, clientKind }) => {
      if (clientKind !== undefined) {
        throw new Error('Edit API accounts on the Orca execution host.')
      }
      return runtime.updateClaudeApiKeyAccount(params)
    }
  }),
  defineMethod({
    name: 'accounts.addClaudeApiKey',
    permission: 'accounts-admin',
    params: AddClaudeApiKeyParams,
    handler: async (params, { runtime, clientKind }) => {
      if (clientKind !== undefined) {
        throw new Error('Add API accounts on the Orca execution host.')
      }
      return runtime.addClaudeApiKeyAccount(params)
    }
  }),
  defineMethod({
    name: 'accounts.addCodexApiKey',
    permission: 'accounts-admin',
    params: AddCodexApiKeyParams,
    handler: async (params, { runtime, clientKind }) => {
      if (clientKind !== undefined) {
        throw new Error('Manage API accounts on the execution host.')
      }
      return runtime.addCodexApiKeyAccount(params)
    }
  }),
  defineMethod({
    name: 'accounts.updateCodexApiKey',
    permission: 'accounts-admin',
    params: UpdateCodexApiKeyParams,
    handler: async (params, { runtime, clientKind }) => {
      if (clientKind !== undefined) {
        throw new Error('Manage API accounts on the execution host.')
      }
      return runtime.updateCodexApiKeyAccount(params)
    }
  }),
  defineMethod({
    name: 'accounts.testApiKey',
    permission: 'accounts-admin',
    params: TestApiAccountParams,
    handler: async (params, { clientKind }) => {
      if (clientKind !== undefined) {
        throw new Error('Test API accounts on the execution host.')
      }
      return testApiAccountConnection(params)
    }
  })
]
