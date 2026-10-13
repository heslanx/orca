import type { HandlerContext } from '../dispatch'
import { RuntimeClientError } from '../runtime-client'
import { ClaudeApiKeyAccountInputSchema } from '../../shared/claude-api-key-account'
import type { RuntimeStatus } from '../../shared/runtime-types'

export type ClaudeAccountCommandContext = Pick<HandlerContext, 'flags' | 'cwd' | 'json'> & {
  client: Pick<HandlerContext['client'], 'call'>
}

export function claudeAccountTextFlag(
  ctx: ClaudeAccountCommandContext,
  name: string,
  allowEmpty = false
): string | undefined {
  const value = ctx.flags.get(name)
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new RuntimeClientError('invalid_argument', `Provide a value for --${name}.`)
  }
  return value.trim()
}

export async function requireClaudeApiCapability(
  ctx: ClaudeAccountCommandContext,
  capability: string
): Promise<void> {
  const status = await ctx.client.call<RuntimeStatus>('status.get')
  if (!status.result.capabilities?.includes(capability)) {
    throw new RuntimeClientError(
      'incompatible_runtime',
      'Update or restart Orca to manage API accounts. The key has not been read.'
    )
  }
}

export async function readClaudeApiKeyInput(
  input: AsyncIterable<Uint8Array | string>
): Promise<string> {
  if (input === process.stdin && process.stdin.isTTY) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Pipe the API key into stdin. Do not pass it as a command-line argument.'
    )
  }
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of input) {
    const buffer = Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > 4098) {
      throw new RuntimeClientError('invalid_argument', 'The API key is too long.')
    }
    chunks.push(buffer)
  }
  const parsed = ClaudeApiKeyAccountInputSchema.shape.apiKey.safeParse(
    Buffer.concat(chunks).toString('utf8')
  )
  if (!parsed.success) {
    throw new RuntimeClientError('invalid_argument', 'Provide one non-empty API key on stdin.')
  }
  return parsed.data
}
