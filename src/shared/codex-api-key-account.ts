import { z } from 'zod'
import { ClaudeApiKeyAccountInputSchema, ClaudeApiKeyConfigSchema } from './claude-api-key-account'

export const CodexApiKeyConfigSchema = ClaudeApiKeyConfigSchema.pick({
  baseUrl: true,
  model: true
}).extend({
  baseUrl: ClaudeApiKeyConfigSchema.shape.baseUrl
    .removeDefault()
    .default('https://api.openai.com/v1'),
  model: z
    .string()
    .trim()
    .min(1)
    .max(256)
    .regex(/^[!-~]+$/),
  organizationId: z
    .string()
    .trim()
    .max(128)
    .regex(/^[A-Za-z0-9_-]*$/)
    .optional(),
  projectId: z
    .string()
    .trim()
    .max(128)
    .regex(/^[A-Za-z0-9_-]*$/)
    .optional()
})
export const CodexApiKeyAccountInputSchema = ClaudeApiKeyAccountInputSchema.extend({
  config: CodexApiKeyConfigSchema
})
export const CodexApiKeyAccountUpdateSchema = z
  .object({
    accountId: z.string().min(1).max(512),
    label: ClaudeApiKeyAccountInputSchema.shape.label.optional(),
    apiKey: ClaudeApiKeyAccountInputSchema.shape.apiKey.optional(),
    config: CodexApiKeyConfigSchema.partial().optional()
  })
  .strict()
  .refine(
    (value) =>
      value.label !== undefined ||
      value.apiKey !== undefined ||
      Object.values(value.config ?? {}).some((field) => field !== undefined),
    'Provide at least one account change.'
  )
export type CodexApiKeyConfig = z.infer<typeof CodexApiKeyConfigSchema>
export type CodexApiKeyAccountInput = z.infer<typeof CodexApiKeyAccountInputSchema>
export type CodexApiKeyAccountUpdate = z.infer<typeof CodexApiKeyAccountUpdateSchema>
