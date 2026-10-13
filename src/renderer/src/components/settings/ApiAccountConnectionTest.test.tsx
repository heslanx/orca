// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ApiAccountConnectionTest } from './ApiAccountConnectionTest'
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
afterEach(cleanup)

function Form({ model = 'test-model' }: { model?: string }) {
  const [pending, setPending] = useState(false)
  return (
    <ApiAccountConnectionTest
      input={{
        provider: 'codex',
        apiKey: 'test-key',
        config: { baseUrl: 'https://gateway.example/v1', model }
      }}
      pending={pending}
      setPending={setPending}
    />
  )
}
it('tests before saving, disables duplicate requests and hides stale results after an edit', async () => {
  const test = vi.fn(async () => ({ ok: true, status: 200, message: 'Verified' }))
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { claudeAccounts: { testApiKey: test } }
  })
  const { rerender } = render(<Form />)
  fireEvent.click(screen.getByRole('button', { name: 'Test connection' }))
  expect(screen.getByRole('button', { name: 'Test connection' })).toHaveProperty('disabled', true)
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('HTTP 200'))
  expect(test).toHaveBeenCalledOnce()
  expect(test).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: 'codex',
      config: expect.objectContaining({ model: 'test-model' })
    })
  )
  rerender(<Form model="different-model" />)
  expect(screen.queryByRole('status')).toBeNull()
})
