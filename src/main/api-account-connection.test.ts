import { expect, it, vi } from 'vitest'
import { testApiAccountConnection } from './api-account-connection'

it('tests the exact Anthropic workspace and model without persisting the key', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ type: 'message' })))
  const result = await testApiAccountConnection(
    {
      provider: 'claude',
      apiKey: 'test-key',
      config: {
        baseUrl: 'https://gateway.example',
        workspaceId: 'wrkspc_test',
        model: 'test-model'
      }
    },
    request
  )
  expect(result.ok).toBe(true)
  expect(request).toHaveBeenCalledWith(
    'https://gateway.example/v1/messages',
    expect.objectContaining({
      redirect: 'error',
      headers: expect.objectContaining({
        'x-api-key': 'test-key',
        'anthropic-workspace-id': 'wrkspc_test'
      })
    })
  )
  expect(JSON.stringify(result)).not.toContain('test-key')
})

it('tests Codex through Responses with project and organization headers', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ object: 'response', status: 'completed' })))
  expect(
    (
      await testApiAccountConnection(
        {
          provider: 'codex',
          apiKey: 'test-key',
          config: {
            baseUrl: 'https://gateway.example/v1',
            model: 'test-model',
            projectId: 'proj_test',
            organizationId: 'org-test'
          }
        },
        request
      )
    ).ok
  ).toBe(true)
  expect(request).toHaveBeenCalledWith(
    'https://gateway.example/v1/responses',
    expect.objectContaining({
      headers: expect.objectContaining({
        'OpenAI-Project': 'proj_test',
        'OpenAI-Organization': 'org-test',
        authorization: 'Bearer test-key'
      })
    })
  )
})

it.each([
  [400, 'workspace is required', 'workspace'],
  [400, 'spend limit reached', 'spending limit'],
  [401, 'secret test-key rejected', 'permissions'],
  [404, 'model does not exist', 'model'],
  [429, 'too many requests', 'rate limit']
])('returns a safe error for HTTP %i', async (status, message, hint) => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(JSON.stringify({ error: { message } }), { status: Number(status) })
    )
  const result = await testApiAccountConnection(
    { provider: 'claude', apiKey: 'test-key', config: {} },
    request
  )
  expect(result.ok).toBe(false)
  expect(result.message).toContain(hint)
  expect(JSON.stringify(result)).not.toContain('test-key')
})

it('rejects invalid workspace IDs before making a network request', async () => {
  const request = vi.fn<typeof fetch>()
  expect(
    (
      await testApiAccountConnection(
        { provider: 'claude', apiKey: 'test-key', config: { workspaceId: 'organization-uuid' } },
        request
      )
    ).ok
  ).toBe(false)
  expect(request).not.toHaveBeenCalled()
})

it('does not accept HTML success pages or expose thrown network errors', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response('<html>OK</html>'))
    .mockRejectedValueOnce(new Error('test-key'))
  for (let i = 0; i < 2; i++) {
    const result = await testApiAccountConnection(
      { provider: 'claude', apiKey: 'test-key', config: {} },
      request
    )
    expect(result.ok).toBe(false)
    expect(result.message).not.toContain('test-key')
  }
})
