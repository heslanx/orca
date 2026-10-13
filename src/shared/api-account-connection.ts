import { z } from 'zod'
import { ClaudeApiKeyAccountInputSchema } from './claude-api-key-account'
import { CodexApiKeyAccountInputSchema } from './codex-api-key-account'

export const ApiAccountConnectionInputSchema = z.discriminatedUnion('provider', [
  ClaudeApiKeyAccountInputSchema.pick({ apiKey: true, config: true }).extend({
    provider: z.literal('claude')
  }),
  CodexApiKeyAccountInputSchema.pick({ apiKey: true, config: true }).extend({
    provider: z.literal('codex')
  })
])
export type ApiAccountConnectionInput = z.infer<typeof ApiAccountConnectionInputSchema>
export type ApiAccountConnectionResult = {
  ok: boolean
  message: string
  status?: number
}
