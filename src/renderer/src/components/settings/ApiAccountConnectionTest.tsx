import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type {
  ApiAccountConnectionInput,
  ApiAccountConnectionResult
} from '../../../../shared/api-account-connection'
import { Button } from '../ui/button'

export function ApiAccountConnectionTest({
  input,
  pending,
  setPending
}: {
  input: ApiAccountConnectionInput
  pending: boolean
  setPending: (value: boolean) => void
}): React.JSX.Element {
  const [testing, setTesting] = useState(false)
  const [report, setReport] = useState<{
    fingerprint: string
    result: ApiAccountConnectionResult
  } | null>(null)
  const fingerprint = JSON.stringify(input)
  async function test(): Promise<void> {
    setPending(true)
    setTesting(true)
    setReport(null)
    try {
      const result = await window.api.claudeAccounts.testApiKey(input)
      setReport({ fingerprint, result })
    } catch {
      setReport({
        fingerprint,
        result: {
          ok: false,
          message: translate(
            'accounts.byok.testFailed',
            'Could not complete the connection test. Try again.'
          )
        }
      })
    } finally {
      setTesting(false)
      setPending(false)
    }
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || !input.apiKey.trim()}
        onClick={() => void test()}
      >
        {testing ? <Loader2 className="size-3 animate-spin" /> : null}
        {translate('accounts.byok.test', 'Test connection')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {translate(
          'accounts.byok.testHint',
          'Sends a short message using these settings. Your provider may charge for this test.'
        )}
      </p>
      {report?.fingerprint === fingerprint ? (
        <p role="status" className="text-xs">
          {report.result.ok
            ? translate('accounts.byok.testSuccess', 'Connection verified.')
            : report.result.message}
          {report.result.status ? ` (HTTP ${report.result.status})` : ''}
        </p>
      ) : null}
    </div>
  )
}
