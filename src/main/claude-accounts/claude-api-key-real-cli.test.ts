import { createServer } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { expect, it } from 'vitest'
import { saveClaudeApiKeyProfile } from './claude-api-key-profile'

// Only a local fake gateway is contacted; this proof never needs a real key or paid tokens.
it.skipIf(process.env.ORCA_REAL_CLAUDE_CLI_TEST !== '1')(
  'the installed Claude CLI sends the selected key, workspace and alias to the selected gateway',
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-byok-real-cli-'))
    const profile = join(root, 'profile')
    mkdirSync(profile)
    const requests: {
      key: string | string[] | undefined
      authorization: string | undefined
      model: unknown
      workspace: string | string[] | undefined
    }[] = []
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = []
      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk))
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      if (request.url?.includes('count_tokens')) {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ input_tokens: 1 }))
        return
      }
      requests.push({
        key: request.headers['x-api-key'],
        authorization: request.headers.authorization,
        model: body.model,
        workspace: request.headers['anthropic-workspace-id']
      })
      const message = {
        id: 'msg_local_test',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 }
      }
      if (body.stream) {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        for (const event of [
          { type: 'message_start', message },
          { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
          { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'BYOK_OK' } },
          { type: 'content_block_stop', index: 0 },
          {
            type: 'message_delta',
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: { output_tokens: 1 }
          },
          { type: 'message_stop' }
        ]) {
          response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
        }
        response.end()
      } else {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(
          JSON.stringify({
            ...message,
            content: [{ type: 'text', text: 'BYOK_OK' }],
            stop_reason: 'end_turn'
          })
        )
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Missing test server address')
      }
      saveClaudeApiKeyProfile(profile, {
        apiKey: 'test-local-byok-key',
        config: {
          baseUrl: `http://127.0.0.1:${address.port}`,
          opusModel: 'test-proxy-opus',
          workspaceId: 'wrkspc_test123'
        }
      })
      writeFileSync(join(profile, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true }))
      const result = await runProcess({
        program: 'claude',
        args: [
          '-p',
          'Reply BYOK_OK',
          '--model',
          'opus',
          '--tools',
          '',
          '--no-session-persistence',
          '--setting-sources',
          'user'
        ],
        cwd: root,
        timeoutMs: 45_000,
        env: {
          PATH: process.env.PATH ?? '',
          HOME: root,
          USERPROFILE: root,
          CLAUDE_CONFIG_DIR: profile,
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
          ANTHROPIC_API_KEY: 'wrong-inherited-key',
          ANTHROPIC_AUTH_TOKEN: 'wrong-inherited-token',
          ANTHROPIC_CUSTOM_HEADERS: 'anthropic-workspace-id: wrkspc_wrong',
          ANTHROPIC_BASE_URL: 'http://127.0.0.1:1'
        }
      })
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toContain('BYOK_OK')
      expect(requests.length).toBeGreaterThan(0)
      for (const request of requests) {
        expect(request.key).toBe('test-local-byok-key')
        expect(request.authorization).toBeUndefined()
        expect(request.model).toBe('test-proxy-opus')
        expect(request.workspace).toBe('wrkspc_test123')
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      rmSync(root, { recursive: true, force: true })
    }
  },
  60_000
)
