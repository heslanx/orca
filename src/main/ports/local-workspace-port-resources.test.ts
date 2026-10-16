import { afterEach, describe, expect, it, vi } from 'vitest'

const { readTable, readResources, runCommand } = vi.hoisted(() => ({
  readTable: vi.fn(),
  readResources: vi.fn(),
  runCommand: vi.fn()
}))

vi.mock('../windows/windows-process-table', () => ({ readWindowsProcessTable: readTable }))
vi.mock('../memory/windows-process-resource-collector', () => ({
  enumerateWindowsProcessResources: readResources
}))
vi.mock('./port-scan-command-client', () => ({ runPortScanCommand: runCommand }))

import {
  loadUnixProcessResourceUsage,
  loadWindowsProcessMetadata
} from './local-workspace-port-resources'

afterEach(() => vi.resetAllMocks())

describe('workspace port resource sampling', () => {
  it('does not query the host without listening process ids', async () => {
    expect(await loadWindowsProcessMetadata(new Set())).toEqual(new Map())
    expect(await loadUnixProcessResourceUsage(new Set())).toEqual(new Map())
    expect(readTable).not.toHaveBeenCalled()
    expect(readResources).not.toHaveBeenCalled()
    expect(runCommand).not.toHaveBeenCalled()
  })

  it('combines native Windows attribution with resource samples only for requested pids', async () => {
    readTable.mockResolvedValue([{ pid: 42, name: 'node', command: 'node app.js' }])
    readResources.mockResolvedValue([
      { pid: 42, cpu: 12, memory: 4096, uptimeSeconds: 30 },
      { pid: 99, cpu: 80, memory: 8192, uptimeSeconds: 60 }
    ])
    expect(await loadWindowsProcessMetadata(new Set([42]))).toEqual(
      new Map([
        [
          42,
          {
            processName: 'node',
            commandLine: 'node app.js',
            cpu: 12,
            memory: 4096,
            uptimeSeconds: 30
          }
        ]
      ])
    )
    expect(runCommand).not.toHaveBeenCalled()
  })

  it('preserves Windows attribution when resource collection is unavailable', async () => {
    readTable.mockResolvedValue([{ pid: 42, name: 'node', command: 'node app.js' }])
    readResources.mockRejectedValue(new Error('Host metrics unavailable'))
    const rows = await loadWindowsProcessMetadata(new Set([42]))
    expect(rows.get(42)).toMatchObject({ processName: 'node', commandLine: 'node app.js' })
    expect(rows.get(42)?.memory).toBeUndefined()
  })

  it('batches Unix resource samples and converts their units', async () => {
    runCommand.mockResolvedValue({ stdout: '42 12,5 1024 1-01:02:03\n99 0.0 2048 00:30' })
    const rows = await loadUnixProcessResourceUsage(new Set([42, 99]))
    expect(runCommand).toHaveBeenCalledTimes(1)
    expect(runCommand).toHaveBeenCalledWith('ps', [
      '-p',
      '42,99',
      '-o',
      'pid=',
      '-o',
      'pcpu=',
      '-o',
      'rss=',
      '-o',
      'etime='
    ])
    expect(rows.get(42)).toEqual({ cpu: 12.5, memory: 1048576, uptimeSeconds: 90123 })
    expect(rows.get(99)).toEqual({ cpu: 0, memory: 2097152, uptimeSeconds: 30 })
  })
})
