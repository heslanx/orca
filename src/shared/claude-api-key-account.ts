import { z } from 'zod'

const modelName = z
  .string()
  .trim()
  .max(256)
  .regex(/^[!-~]*$/)
  .optional()

export const ClaudeApiKeyConfigSchema = z
  .object({
    baseUrl: z
      .string()
      .trim()
      .max(2048)
      .refine((value) => {
        try {
          const url = new URL(value)
          const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
          return (
            (url.protocol === 'https:' || (local && url.protocol === 'http:')) &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash
          )
        } catch {
          return false
        }
      }, 'Use an HTTPS API URL, or HTTP for localhost, without credentials or query parameters.')
      .default('https://api.anthropic.com'),
    model: modelName,
    opusModel: modelName,
    sonnetModel: modelName,
    haikuModel: modelName,
    workspaceId: z
      .string()
      .trim()
      .max(128)
      .regex(
        /^(?:wrkspc_[A-Za-z0-9]+)?$/,
        'Use a workspace ID starting with wrkspc_, not an organization ID.'
      )
      .optional()
  })
  .strict()

export const ClaudeApiKeyAccountInputSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    apiKey: z
      .string()
      .trim()
      .min(1)
      .max(4096)
      .regex(/^\S+$/, 'The API key cannot contain whitespace.'),
    config: ClaudeApiKeyConfigSchema,
    runtime: z.enum(['host', 'wsl']).optional(),
    wslDistro: z.string().trim().min(1).max(255).nullish()
  })
  .strict()

export type ClaudeApiKeyConfig = z.infer<typeof ClaudeApiKeyConfigSchema>
export type ClaudeApiKeyAccountInput = z.infer<typeof ClaudeApiKeyAccountInputSchema>

export const ClaudeApiKeyAccountUpdateSchema = z
  .object({
    accountId: z.string().min(1).max(512),
    label: ClaudeApiKeyAccountInputSchema.shape.label.optional(),
    apiKey: ClaudeApiKeyAccountInputSchema.shape.apiKey.optional(),
    config: ClaudeApiKeyConfigSchema.extend({
      baseUrl: ClaudeApiKeyConfigSchema.shape.baseUrl.removeDefault().optional()
    }).optional()
  })
  .strict()
  .refine(
    (value) =>
      value.label !== undefined ||
      value.apiKey !== undefined ||
      Object.values(value.config ?? {}).some((field) => field !== undefined),
    'Provide at least one account change.'
  )

export type ClaudeApiKeyAccountUpdate = z.infer<typeof ClaudeApiKeyAccountUpdateSchema>
