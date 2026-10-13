import {
  ApiAccountConnectionInputSchema,
  type ApiAccountConnectionResult
} from '../shared/api-account-connection'

export async function testApiAccountConnection(
  input: unknown,
  request: typeof fetch = fetch
): Promise<ApiAccountConnectionResult> {
  const parsed = ApiAccountConnectionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Check the key, API URL, model and workspace/project IDs.' }
  }
  const { apiKey, config, provider } = parsed.data
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  let body: Record<string, unknown>
  if (provider === 'claude') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
    if (parsed.data.config.workspaceId) {
      headers['anthropic-workspace-id'] = parsed.data.config.workspaceId
    }
    body = {
      model: config.model || parsed.data.config.haikuModel || 'claude-haiku-4-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply OK.' }]
    }
  } else {
    headers.authorization = `Bearer ${apiKey}`
    if (parsed.data.config.organizationId) {
      headers['OpenAI-Organization'] = parsed.data.config.organizationId
    }
    if (parsed.data.config.projectId) {
      headers['OpenAI-Project'] = parsed.data.config.projectId
    }
    body = { model: config.model, input: 'Reply OK.', max_output_tokens: 16, store: false }
  }
  const base = config.baseUrl.replace(/\/+$/, '')
  const endpoint = provider === 'claude' ? `${base}/v1/messages` : `${base}/responses`
  try {
    const response = await request(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(20_000)
    })
    const data: unknown = await response.json()
    if (response.ok) {
      const valid =
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === (provider === 'claude' ? 'message' : 'response')
      // OpenAI Responses uses "object" rather than "type".
      const validResponse =
        provider === 'codex' &&
        data &&
        typeof data === 'object' &&
        'object' in data &&
        data.object === 'response'
      return valid || validResponse
        ? {
            ok: true,
            status: response.status,
            message: 'Connection verified with a short API request.'
          }
        : {
            ok: false,
            status: response.status,
            message: 'The endpoint did not return the expected API response.'
          }
    }
    const detail = JSON.stringify(data).toLowerCase()
    const message = /workspace/.test(detail)
      ? 'Check the Anthropic workspace ID and the key’s access to it.'
      : /credit|billing|spend.limit|insufficient_quota/.test(detail)
        ? 'The provider rejected the request because of billing or a spending limit.'
        : response.status === 401 || response.status === 403
          ? 'The provider rejected the key or its permissions.'
          : /model/.test(detail)
            ? 'The provider rejected this model. Check the model ID and access.'
            : response.status === 429
              ? 'The provider rate limit was reached. Try again later.'
              : 'The provider rejected the request. Check the endpoint and account configuration.'
    return { ok: false, status: response.status, message }
  } catch {
    return {
      ok: false,
      message:
        'Could not complete the connection test. Check the endpoint and network, then try again.'
    }
  }
}
