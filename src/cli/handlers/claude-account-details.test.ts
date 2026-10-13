import { Readable } from 'node:stream'
import { afterEach, expect, it, vi } from 'vitest'
import { findCommandSpec, parseArgs, validateCommandAndFlags } from '../args'
import { COMMAND_SPECS } from '../specs'
import {
  CLAUDE_API_KEY_EDIT_RUNTIME_CAPABILITY,
  CLAUDE_API_KEY_WORKSPACE_RUNTIME_CAPABILITY
} from '../../shared/protocol-version'
import {
  editClaudeApiAccount,
  listClaudeAccounts,
  showClaudeAccount
} from './claude-account-details'

afterEach(() => vi.restoreAllMocks())

function fixture(supported = true) {
  const state = {
    accounts: [
      {
        id: 'api-id',
        email: 'Gateway',
        authMethod: 'api-key',
        createdAt: 1,
        updatedAt: 1,
        lastAuthenticatedAt: 1,
        apiKeyConfig: { baseUrl: 'https://proxy.example.test', model: 'current-model' }
      }
    ],
    activeAccountId: 'api-id'
  }
  const call = vi.fn(async (method: string) => ({
    id: 'response',
    ok: true,
    result:
      method === 'status.get'
        ? {
            capabilities: supported
              ? [
                  CLAUDE_API_KEY_EDIT_RUNTIME_CAPABILITY,
                  CLAUDE_API_KEY_WORKSPACE_RUNTIME_CAPABILITY
                ]
              : []
          }
        : method === 'accounts.list'
          ? { claude: state, codex: { accounts: ['unrelated'] } }
          : state,
    _meta: { runtimeId: 'test' }
  }))
  const ctx = {
    flags: new Map<string, string | boolean>([
      ['agent', 'claude'],
      ['account', 'api-id']
    ]),
    cwd: '/tmp/orca-test',
    json: true,
    client: { call: vi.fn().mockImplementation(call) }
  }
  const output = vi.spyOn(console, 'log').mockImplementation(() => {})
  return { state, ctx, call, output }
}

it('returns only the selected provider or account in JSON, with active status and model configuration', async () => {
  const { ctx, output, call } = fixture()
  await listClaudeAccounts(ctx)
  expect(JSON.parse(String(output.mock.calls[0][0])).result).not.toHaveProperty('codex')
  await showClaudeAccount(ctx)
  expect(JSON.parse(String(output.mock.calls[1][0])).result).toMatchObject({
    id: 'api-id',
    active: true,
    apiKeyConfig: { model: 'current-model' }
  })
  expect(call).toHaveBeenCalledWith('accounts.list', { refreshUsage: false })
})

it('edits metadata without reading stdin or replacing omitted configuration', async () => {
  const { ctx, call } = fixture()
  ctx.flags.set('label', 'New name')
  let consumed = false
  async function* input() {
    consumed = true
    yield 'unrequested-key'
  }
  await editClaudeApiAccount(ctx, input())
  expect(consumed).toBe(false)
  expect(call).toHaveBeenLastCalledWith(
    'accounts.updateClaudeApiKey',
    {
      accountId: 'api-id',
      label: 'New name',
      config: {
        baseUrl: undefined,
        model: undefined,
        opusModel: undefined,
        sonnetModel: undefined,
        haikuModel: undefined,
        workspaceId: undefined
      }
    },
    { timeoutMs: 60_000 }
  )
})

it('rotates a key through stdin and accepts clearing a model override', async () => {
  const { ctx, call, output } = fixture()
  ctx.flags.set('api-key-stdin', true)
  ctx.flags.set('model', '')
  await editClaudeApiAccount(ctx, Readable.from(['test-new-key\n']))
  expect(call).toHaveBeenLastCalledWith(
    'accounts.updateClaudeApiKey',
    expect.objectContaining({
      apiKey: 'test-new-key',
      config: expect.objectContaining({ model: '' })
    }),
    { timeoutMs: 60_000 }
  )
  expect(JSON.stringify(output.mock.calls)).not.toContain('test-new-key')
})

it('refuses old hosts before consuming a replacement key', async () => {
  const { ctx, call } = fixture(false)
  ctx.flags.set('api-key-stdin', true)
  let consumed = false
  async function* input() {
    consumed = true
    yield 'test-key'
  }
  await expect(editClaudeApiAccount(ctx, input())).rejects.toThrow('key has not been read')
  expect(consumed).toBe(false)
  expect(call).toHaveBeenCalledTimes(1)
})

it('rejects missing accounts and OAuth accounts before consuming a key', async () => {
  const { ctx, state, call } = fixture()
  ctx.flags.set('api-key-stdin', true)
  let consumed = false
  async function* input() {
    consumed = true
    yield 'test-key'
  }
  state.accounts[0].authMethod = 'subscription-oauth'
  await expect(editClaudeApiAccount(ctx, input())).rejects.toThrow(
    'Only native Claude API accounts'
  )
  ctx.flags.set('account', 'missing')
  await expect(editClaudeApiAccount(ctx, input())).rejects.toThrow('not found')
  expect(consumed).toBe(false)
  expect(call.mock.calls.every(([method]) => method !== 'accounts.updateClaudeApiKey')).toBe(true)
})

it.each(
  [
    [],
    [['base-url', 'http://remote.example']],
    [['agent', 'cursor']],
    [['environment', 'other-host']],
    [['pairing-code', 'other-host']],
    [['api-key-stdin', 'raw-key']]
  ].map((flags) => ({ flags }))
)('rejects invalid edits before contacting the host', async ({ flags }) => {
  const { ctx, call } = fixture()
  for (const [name, value] of flags) {
    ctx.flags.set(name, value)
  }
  await expect(editClaudeApiAccount(ctx, Readable.from([]))).rejects.toThrow()
  expect(call).not.toHaveBeenCalled()
})

it('advertises the update alias, empty model overrides and credential-safe flags', () => {
  const parsed = parseArgs(['account', 'update', '--account', 'api-id', '--model', '', '--json'])
  validateCommandAndFlags(COMMAND_SPECS, parsed)
  expect(findCommandSpec(COMMAND_SPECS, parsed.commandPath)?.path).toEqual(['account', 'edit'])
  expect(parsed.flags.get('model')).toBe('')
  expect(() =>
    validateCommandAndFlags(COMMAND_SPECS, parseArgs(['account', 'edit', '--api-key', 'secret']))
  ).toThrow()
})

it.each(['wrkspc_test123', ''])(
  'updates or clears a workspace without reading a key: %s',
  async (workspaceId) => {
    const { ctx, call } = fixture()
    ctx.flags.set('workspace-id', workspaceId)
    await editClaudeApiAccount(ctx, Readable.from([]))
    expect(call).toHaveBeenLastCalledWith(
      'accounts.updateClaudeApiKey',
      expect.objectContaining({ config: expect.objectContaining({ workspaceId }) }),
      { timeoutMs: 60_000 }
    )
  }
)
