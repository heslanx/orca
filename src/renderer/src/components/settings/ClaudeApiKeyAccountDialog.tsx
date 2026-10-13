import { useId, useState } from 'react'
import { ApiAccountConnectionTest } from './ApiAccountConnectionTest'
import { KeyRound, Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { ClaudeApiKeyAccountInputSchema } from '../../../../shared/claude-api-key-account'
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
import type { ClaudeAccountActionRunner, LocalAccountRuntime } from './accounts-pane-types'

type Props = {
  disabled: boolean
  runtime: LocalAccountRuntime
  runAction: ClaudeAccountActionRunner
}

export function ClaudeApiKeyAccountDialog({
  disabled,
  runtime,
  runAction
}: Props): React.JSX.Element {
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
        <ClaudeApiKeyAccountForm
          runtime={runtime}
          runAction={runAction}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Dialog>
  )
}

function ClaudeApiKeyAccountForm({
  runtime,
  runAction,
  onClose
}: Omit<Props, 'disabled'> & { onClose: () => void }): React.JSX.Element {
  const id = useId()
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.anthropic.com')
  const [workspaceId, setWorkspaceId] = useState('')
  const [model, setModel] = useState('')
  const [opusModel, setOpusModel] = useState('')
  const [sonnetModel, setSonnetModel] = useState('')
  const [haikuModel, setHaikuModel] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(): Promise<void> {
    if (pending) {
      return
    }
    const parsed = ClaudeApiKeyAccountInputSchema.safeParse({
      label,
      apiKey,
      runtime: runtime.runtime,
      wslDistro: runtime.wslDistro,
      config: { baseUrl, workspaceId, model, opusModel, sonnetModel, haikuModel }
    })
    if (!parsed.success) {
      if (parsed.error.issues.some((issue) => issue.path.includes('workspaceId'))) {
        setError(
          translate(
            'accounts.claude.byok.invalidWorkspace',
            'Use a workspace ID starting with wrkspc_, not an organization ID.'
          )
        )
        return
      }
      setError(
        translate(
          'accounts.claude.byok.invalid',
          'Enter a name, a valid key, and an HTTPS API URL (HTTP is allowed for localhost). Model IDs cannot contain spaces.'
        )
      )
      return
    }
    setPending(true)
    setError(null)
    try {
      await runAction(
        'adding-api-key',
        async () => {
          try {
            const next = await window.api.claudeAccounts.addApiKey(parsed.data)
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
        <DialogTitle>
          {translate('accounts.claude.byok.title', 'Add Claude API account')}
        </DialogTitle>
        <DialogDescription>
          {translate(
            'accounts.claude.byok.description',
            'Use your own Anthropic key or an Anthropic-compatible gateway. Select this account after saving to use it for new Claude sessions.'
          )}
        </DialogDescription>
        <p className="text-xs text-muted-foreground">
          {translate(
            'accounts.claude.byok.storage',
            'The key is saved in this account’s local Claude settings, readable only by your operating-system user. API usage is billed by your provider.'
          )}
        </p>
      </DialogHeader>
      <form
        className="min-h-0 space-y-4 overflow-y-auto scrollbar-sleek"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <fieldset disabled={pending} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`}>
              {translate('accounts.claude.byok.name', 'Account name')}
            </Label>
            <Input
              id={`${id}-name`}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              required
              maxLength={120}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-key`}>{translate('accounts.claude.byok.key', 'API key')}</Label>
            <Input
              id={`${id}-key`}
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              required
              maxLength={4096}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-url`}>
              {translate('accounts.claude.byok.url', 'API base URL')}
            </Label>
            <Input
              id={`${id}-url`}
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              required
              maxLength={2048}
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              {translate(
                'accounts.claude.byok.urlHint',
                'Use the gateway base URL, without /v1/messages.'
              )}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-workspace`}>
              {translate('accounts.claude.byok.workspace', 'Anthropic workspace ID (optional)')}
            </Label>
            <Input
              id={`${id}-workspace`}
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              placeholder="wrkspc_..."
              maxLength={128}
              spellCheck={false}
              aria-describedby={`${id}-workspace-hint`}
            />
            <p id={`${id}-workspace-hint`} className="text-xs text-muted-foreground">
              {translate(
                'accounts.claude.byok.workspaceHint',
                'Required for a key that is not scoped to one workspace. Find it in Claude Console → Settings → Workspaces.'
              )}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-model`}>
              {translate('accounts.claude.byok.model', 'Default model (optional)')}
            </Label>
            <Input
              id={`${id}-model`}
              value={model}
              onChange={(event) => setModel(event.target.value)}
              maxLength={256}
              spellCheck={false}
            />
          </div>
          <details className="space-y-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              {translate('accounts.claude.byok.aliases', 'Gateway model aliases (optional)')}
            </summary>
            {[
              { name: 'Opus', value: opusModel, set: setOpusModel },
              { name: 'Sonnet', value: sonnetModel, set: setSonnetModel },
              { name: 'Haiku', value: haikuModel, set: setHaikuModel }
            ].map((field) => (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={`${id}-${field.name}`}>{field.name}</Label>
                <Input
                  id={`${id}-${field.name}`}
                  value={field.value}
                  onChange={(event) => field.set(event.target.value)}
                  maxLength={256}
                  spellCheck={false}
                />
              </div>
            ))}
          </details>
        </fieldset>
        <ApiAccountConnectionTest
          input={{
            provider: 'claude',
            apiKey,
            config: { baseUrl, workspaceId, model, opusModel, sonnetModel, haikuModel }
          }}
          pending={pending}
          setPending={setPending}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {translate('accounts.claude.byok.cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {translate('accounts.claude.byok.save', 'Save account')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
