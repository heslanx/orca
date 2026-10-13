// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClaudeApiKeyAccountDialog } from './ClaudeApiKeyAccountDialog'
import type { ClaudeAccountActionRunner } from './accounts-pane-types'

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
afterEach(cleanup)

function setup(reject = false) {
  const addApiKey = vi.fn(async () => {
    if (reject) {
      throw new Error('backend detail that should not be shown')
    }
    return { accounts: [], activeAccountId: null }
  })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { claudeAccounts: { addApiKey } }
  })
  const runAction: ClaudeAccountActionRunner = async (_action, operation) => {
    await operation().catch(() => {})
  }
  render(
    <ClaudeApiKeyAccountDialog
      disabled={false}
      runtime={{ runtime: 'host', label: 'macOS' }}
      runAction={runAction}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Add API key' }))
  fireEvent.change(screen.getByLabelText('Account name'), { target: { value: 'My gateway' } })
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'test-only-key' } })
  fireEvent.change(screen.getByLabelText('API base URL'), {
    target: { value: 'https://gateway.example.test' }
  })
  return addApiKey
}

describe('Claude API account dialog', () => {
  it('masks the key, saves once, and clears the key when reopened', async () => {
    const add = setup()
    expect(screen.getByLabelText('API key').getAttribute('type')).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(add).toHaveBeenCalledOnce()
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'My gateway',
        apiKey: 'test-only-key',
        config: expect.objectContaining({ baseUrl: 'https://gateway.example.test' })
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add API key' }))
    expect(screen.getByLabelText('API key')).toHaveProperty('value', '')
  })

  it('retains the draft on failure and shows no raw backend error', async () => {
    setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not save'))
    expect(screen.getByLabelText('Account name')).toHaveProperty('value', 'My gateway')
    expect(screen.getByLabelText('API key')).toHaveProperty('value', 'test-only-key')
    expect(document.body.textContent).not.toContain('backend detail')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add API key' }))
    expect(screen.getByLabelText('API key')).toHaveProperty('value', '')
  })

  it('rejects a non-local HTTP endpoint without sending the key', async () => {
    const add = setup()
    fireEvent.change(screen.getByLabelText('API base URL'), {
      target: { value: 'http://gateway.example.test' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('HTTPS'))
    expect(add).not.toHaveBeenCalled()
  })
})

it('sends a workspace ID and rejects organization IDs without saving', async () => {
  const add = setup()
  fireEvent.change(screen.getByLabelText('Anthropic workspace ID (optional)'), {
    target: { value: 'd6f7ccb1-be4c-4442-af23-cb32b2296ae4' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save account' }))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('not an organization ID')
  )
  expect(add).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Anthropic workspace ID (optional)'), {
    target: { value: 'wrkspc_test123' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save account' }))
  await waitFor(() =>
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ workspaceId: 'wrkspc_test123' })
      })
    )
  )
})
