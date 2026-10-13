import { useId, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { CodexApiKeyAccountInputSchema } from '../../../../shared/codex-api-key-account'
import { ApiAccountConnectionTest } from './ApiAccountConnectionTest'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../ui/dialog'
import type { CodexAccountActionRunner, LocalAccountRuntime } from './accounts-pane-types'

export function CodexApiKeyAccountDialog({
  disabled,
  runtime,
  runAction
}: {
  disabled: boolean
  runtime: LocalAccountRuntime
  runAction: CodexAccountActionRunner
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="xs" disabled={disabled}>
          <KeyRound className="size-3" />
          {translate('accounts.claude.byok.add', 'Add API key')}
        </Button>
      </DialogTrigger>
      {open ? (
        <CodexApiKeyForm runtime={runtime} runAction={runAction} onClose={() => setOpen(false)} />
      ) : null}
    </Dialog>
  )
}

function CodexApiKeyForm({
  runtime,
  runAction,
  onClose
}: {
  runtime: LocalAccountRuntime
  runAction: CodexAccountActionRunner
  onClose: () => void
}): React.JSX.Element {
  const id = useId()
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [model, setModel] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const config = { baseUrl, model, organizationId, projectId }
  async function save(): Promise<void> {
    if (pending) {
      return
    }
    const parsed = CodexApiKeyAccountInputSchema.safeParse({
      label,
      apiKey,
      config,
      runtime: runtime.runtime
    })
    if (!parsed.success) {
      setError(
        translate(
          'accounts.codex.byok.invalid',
          'Enter a name, key, HTTPS API URL and model ID. Organization and project IDs cannot contain spaces.'
        )
      )
      return
    }
    setPending(true)
    setError(null)
    try {
      await runAction(
        'adding',
        async () => {
          try {
            const next = await window.api.codexAccounts.addApiKey(parsed.data)
            setApiKey('')
            onClose()
            return next
          } catch {
            const message = translate(
              'accounts.claude.byok.failed',
              'Could not save the API account. Your entries are still here; try again.'
            )
            setError(message)
            throw new Error(message)
          }
        },
        runtime
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <DialogContent
      showCloseButton={!pending}
      className="max-h-[90vh] overflow-hidden"
      onInteractOutside={(event) => {
        if (pending) {
          event.preventDefault()
        }
      }}
      onEscapeKeyDown={(event) => {
        if (pending) {
          event.preventDefault()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{translate('accounts.codex.byok.title', 'Add Codex API account')}</DialogTitle>
        <DialogDescription>
          {translate(
            'accounts.codex.byok.description',
            'Use an OpenAI key or a gateway that supports the Responses API. Save, then select this account for new Codex sessions.'
          )}
        </DialogDescription>
        <p className="text-xs text-muted-foreground">
          {translate(
            'accounts.codex.byok.storage',
            'The key is saved in this account’s private local files, readable only by your operating-system user. API usage is billed by your provider.'
          )}
        </p>
      </DialogHeader>
      <form
        className="min-h-0 space-y-4 overflow-y-auto scrollbar-sleek"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <fieldset disabled={pending} className="space-y-3">
          {[
            {
              name: 'name',
              label: translate('accounts.claude.byok.name', 'Account name'),
              value: label,
              set: setLabel,
              required: true,
              max: 120
            },
            {
              name: 'key',
              label: translate('accounts.claude.byok.key', 'API key'),
              value: apiKey,
              set: setApiKey,
              required: true,
              max: 4096
            },
            {
              name: 'url',
              label: translate('accounts.claude.byok.url', 'API base URL'),
              value: baseUrl,
              set: setBaseUrl,
              required: true,
              max: 2048
            },
            {
              name: 'model',
              label: translate('accounts.codex.byok.model', 'Model ID'),
              value: model,
              set: setModel,
              required: true,
              max: 256
            },
            {
              name: 'organization',
              label: translate(
                'accounts.codex.byok.organization',
                'OpenAI organization ID (optional)'
              ),
              value: organizationId,
              set: setOrganizationId,
              required: false,
              max: 128
            },
            {
              name: 'project',
              label: translate('accounts.codex.byok.project', 'OpenAI project ID (optional)'),
              value: projectId,
              set: setProjectId,
              required: false,
              max: 128
            }
          ].map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={`${id}-${field.name}`}>{field.label}</Label>
              <Input
                id={`${id}-${field.name}`}
                value={field.value}
                onChange={(event) => field.set(event.target.value)}
                type={field.name === 'key' ? 'password' : field.name === 'url' ? 'url' : 'text'}
                autoComplete="off"
                spellCheck={false}
                required={field.required}
                maxLength={field.max}
                autoFocus={field.name === 'name'}
              />
            </div>
          ))}
        </fieldset>
        <ApiAccountConnectionTest
          input={{ provider: 'codex', apiKey, config }}
          pending={pending}
          setPending={setPending}
        />
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
            {translate('accounts.claude.byok.cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {translate('accounts.claude.byok.save', 'Save account')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
