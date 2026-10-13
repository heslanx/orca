import { Readable } from 'node:stream'
import { afterEach, expect, it, vi } from 'vitest'
import {
  CLAUDE_API_KEY_RUNTIME_CAPABILITY,
  CLAUDE_API_KEY_WORKSPACE_RUNTIME_CAPABILITY
} from '../../shared/protocol-version'
import { addClaudeApiAccount, mutateClaudeAccount } from './claude-api-account'

afterEach(() => vi.restoreAllMocks())

function context(supported = true) {
  const account = {
    id: 'api-id',
    email: 'Gateway',
    authMethod: 'api-key',
    createdAt: 1,
    updatedAt: 1,
    lastAuthenticatedAt: 1
  }
  const call = vi.fn(async (method: string) => ({
    id: 'response',
    ok: true,
    result:
      method === 'status.get'
        ? {
            capabilities: supported
              ? [CLAUDE_API_KEY_RUNTIME_CAPABILITY, CLAUDE_API_KEY_WORKSPACE_RUNTIME_CAPABILITY]
              : []
          }
        : { accounts: [account], activeAccountId: null },
    _meta: { runtimeId: 'test' }
  }))
  const ctx = {
    flags: new Map<string, string | boolean>([
      ['api-key-stdin', true],
      ['label', 'Gateway'],
      ['base-url', 'https://proxy.example.test'],
      ['opus-model', 'custom-opus']
    ]),
    cwd: '/tmp/orca-test',
    json: false,
    client: { call: vi.fn().mockImplementation(call) }
  }
  return { ctx, call }
}

it('reads a bounded key from stdin, passes config to the host and prints only account metadata', async () => {
  const { ctx, call } = context()
  const output = vi.spyOn(console, 'log').mockImplementation(() => {})
  await addClaudeApiAccount(ctx, Readable.from(['test-pipe-key\n']))
  expect(call).toHaveBeenCalledWith(
    'accounts.addClaudeApiKey',
    expect.objectContaining({
      label: 'Gateway',
      apiKey: 'test-pipe-key',
      config: expect.objectContaining({
        baseUrl: 'https://proxy.example.test',
        opusModel: 'custom-opus'
      })
    }),
    { timeoutMs: 60_000 }
  )
  expect(JSON.stringify(output.mock.calls)).toContain('api-id')
  expect(JSON.stringify(output.mock.calls)).not.toContain('test-pipe-key')
})

it('rejects an older host before consuming the key', async () => {
  const { ctx, call } = context(false)
  let consumed = false
  async function* input() {
    consumed = true
    yield 'test-key'
  }
  await expect(addClaudeApiAccount(ctx, input())).rejects.toThrow('key has not been read')
  expect(consumed).toBe(false)
  expect(call).toHaveBeenCalledTimes(1)
})

it.each(['', 'two keys', 'x'.repeat(4099)])(
  'rejects invalid stdin without registering an account',
  async (key) => {
    const { ctx, call } = context()
    await expect(addClaudeApiAccount(ctx, Readable.from([key]))).rejects.toThrow()
    expect(call.mock.calls.map(([method]) => method)).toEqual(['status.get'])
  }
)

it('selects API/OAuth accounts and System default through the existing Claude host method', async () => {
  const { ctx, call } = context()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  ctx.flags.set('account', 'api-id')
  await mutateClaudeAccount(ctx, 'select')
  expect(call).toHaveBeenLastCalledWith('accounts.selectClaude', { accountId: 'api-id' })
  ctx.flags.set('account', 'system')
  await mutateClaudeAccount(ctx, 'select')
  expect(call).toHaveBeenLastCalledWith('accounts.selectClaude', { accountId: null })
  await expect(mutateClaudeAccount(ctx, 'remove')).rejects.toThrow('saved Claude account ID')
})

it('refuses workspace configuration on hosts without the workspace capability before reading stdin', async () => {
  const { ctx, call } = context()
  call.mockResolvedValueOnce({
    id: 'response',
    ok: true,
    result: { capabilities: [CLAUDE_API_KEY_RUNTIME_CAPABILITY] },
    _meta: { runtimeId: 'test' }
  })
  call.mockResolvedValueOnce({
    id: 'response',
    ok: true,
    result: { capabilities: [CLAUDE_API_KEY_RUNTIME_CAPABILITY] },
    _meta: { runtimeId: 'test' }
  })
  ctx.flags.set('workspace-id', 'wrkspc_test123')
  let consumed = false
  async function* input() {
    consumed = true
    yield 'test-key'
  }
  await expect(addClaudeApiAccount(ctx, input())).rejects.toThrow('key has not been read')
  expect(consumed).toBe(false)
})
