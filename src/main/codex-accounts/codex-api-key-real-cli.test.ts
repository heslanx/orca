import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { expect, it } from 'vitest'
import { saveCodexApiKeyProfile } from './codex-api-key-profile'

it.skipIf(process.env.ORCA_REAL_CODEX_CLI_TEST !== '1')(
  'the installed Codex CLI sends the saved key, model and project to its gateway',
  async () => {
    const home = mkdtempSync(join(tmpdir(), 'orca-codex-byok-cli-'))
    const requests: {
      auth: string | undefined
      project: string | string[] | undefined
      model: unknown
    }[] = []
    const server = createServer(async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(404).end()
        return
      }
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk))
      }
      const data = JSON.parse(Buffer.concat(chunks).toString())
      requests.push({
        auth: req.headers.authorization,
        project: req.headers['openai-project'],
        model: data.model
      })
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const event of [
        { type: 'response.created', response: { id: 'response-test' } },
        {
          type: 'response.output_item.done',
          item: {
            type: 'message',
            role: 'assistant',
            id: 'msg-test',
            content: [{ type: 'output_text', text: 'BYOK_OK' }]
          }
        },
        {
          type: 'response.completed',
          response: {
            id: 'response-test',
            usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }
          }
        }
      ]) {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }
      res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('No local gateway port')
      }
      saveCodexApiKeyProfile(
        home,
        {
          apiKey: 'test-codex-key',
          config: {
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: 'gpt-5.4',
            projectId: 'proj_test'
          }
        },
        ''
      )
      const result = await runProcess({
        program: 'codex',
        args: [
          'exec',
          '--skip-git-repo-check',
          '--ephemeral',
          '--sandbox',
          'read-only',
          'Reply BYOK_OK.'
        ],
        cwd: home,
        timeoutMs: 45_000,
        env: {
          PATH: process.env.PATH ?? '',
          HOME: home,
          USERPROFILE: home,
          CODEX_HOME: home,
          OPENAI_API_KEY: 'wrong-inherited-key'
        }
      })
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toContain('BYOK_OK')
      expect(requests.length).toBeGreaterThan(0)
      for (const request of requests) {
        expect(request).toEqual({
          auth: 'Bearer test-codex-key',
          project: 'proj_test',
          model: 'gpt-5.4'
        })
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      rmSync(home, { recursive: true, force: true })
    }
  },
  60_000
)
