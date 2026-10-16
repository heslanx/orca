// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspacePort, WorkspacePortScanResult } from '../../../shared/workspace-ports'

const { runWorkspacePortScanForTargetMock } = vi.hoisted(() => ({
  runWorkspacePortScanForTargetMock: vi.fn()
}))

vi.mock('./workspace-port-scan-client', () => ({
  runWorkspacePortScanForTarget: runWorkspacePortScanForTargetMock
}))

const {
  canStopWorkspacePort,
  mergeWorkspacePortScans,
  scanWorkspacePortsForTarget,
  workspacePortRuntimeTargetKey,
  workspacePortScanKeyForTarget
} = await import('./workspace-port-actions')

function scanWithPort(port: WorkspacePort | null, scannedAt = 1): WorkspacePortScanResult {
  return { platform: 'darwin', scannedAt, ports: port ? [port] : [] }
}

function workspacePort(overrides: Partial<WorkspacePort> = {}): WorkspacePort {
  return {
    id: 'tcp:5199',
    bindHost: '127.0.0.1',
    connectHost: '127.0.0.1',
    port: 5199,
    processName: 'node',
    protocol: 'http',
    kind: 'workspace',
    pid: 4242,
    owner: {
      worktreeId: 'wt-1',
      repoId: 'repo',
      displayName: 'main',
      path: '/repo',
      confidence: 'cwd'
    },
    ...overrides
  }
}

describe('mergeWorkspacePortScans', () => {
  it('returns a single entry verbatim, without prefixing ids', () => {
    const scan = scanWithPort(workspacePort())
    expect(mergeWorkspacePortScans({ 'local:all': scan })).toBe(scan)
  })

  it('concatenates ports across multiple entries with key-prefixed ids', () => {
    const merged = mergeWorkspacePortScans({
      'local:all': scanWithPort(workspacePort({ id: 'tcp:5199' })),
      'environment:x:all': scanWithPort(workspacePort({ id: 'tcp:6000' }))
    })
    expect(merged?.ports.map((p) => p.id)).toEqual([
      'environment:x:all:tcp:6000',
      'local:all:tcp:5199'
    ])
  })

  it('returns null when there is nothing to merge', () => {
    expect(mergeWorkspacePortScans({})).toBeNull()
  })
})

describe('canStopWorkspacePort', () => {
  it('allows stopping a workspace-owned port with a pid', () => {
    expect(canStopWorkspacePort(workspacePort())).toBe(true)
  })

  it('refuses an external (non-workspace) port even with a pid', () => {
    expect(canStopWorkspacePort(workspacePort({ kind: 'external' }))).toBe(false)
  })

  it('refuses a port with no pid', () => {
    expect(canStopWorkspacePort(workspacePort({ pid: undefined }))).toBe(false)
  })

  it('refuses Electron itself, even though it is a workspace port with a pid', () => {
    // Why: pinning this guard — Orca's own renderer/main process can show up as a
    // workspace-owned listener; letting it be "stopped" from the Ports popover
    // would kill the app.
    expect(canStopWorkspacePort(workspacePort({ processName: 'Electron' }))).toBe(false)
  })
})

describe('workspacePortRuntimeTargetKey / workspacePortScanKeyForTarget', () => {
  it('keys a local target as "local"', () => {
    expect(workspacePortRuntimeTargetKey({ kind: 'local' })).toBe('local')
    expect(workspacePortScanKeyForTarget({ kind: 'local' })).toBe('local:all')
  })

  it('keys an environment target by its environment id', () => {
    expect(workspacePortRuntimeTargetKey({ kind: 'environment', environmentId: 'env-1' })).toBe(
      'environment:env-1'
    )
    expect(workspacePortScanKeyForTarget({ kind: 'environment', environmentId: 'env-1' })).toBe(
      'environment:env-1:all'
    )
  })
})

describe('scanWorkspacePortsForTarget', () => {
  afterEach(() => {
    runWorkspacePortScanForTargetMock.mockReset()
  })

  it('coalesces concurrent scans of the same target into a single underlying call', async () => {
    let resolveScan: (scan: WorkspacePortScanResult) => void = () => {}
    runWorkspacePortScanForTargetMock.mockImplementation(
      () =>
        new Promise<WorkspacePortScanResult>((resolve) => {
          resolveScan = resolve
        })
    )

    const target = { kind: 'local' as const }
    const first = scanWorkspacePortsForTarget(target)
    const second = scanWorkspacePortsForTarget(target)

    expect(runWorkspacePortScanForTargetMock).toHaveBeenCalledTimes(1)
    resolveScan(scanWithPort(null))
    await expect(first).resolves.toBe(await second)
  })

  it('issues a fresh call once the previous scan for that target has settled', async () => {
    runWorkspacePortScanForTargetMock
      .mockResolvedValueOnce(scanWithPort(null, 1))
      .mockResolvedValueOnce(scanWithPort(null, 2))

    const target = { kind: 'local' as const }
    await scanWorkspacePortsForTarget(target)
    await scanWorkspacePortsForTarget(target)

    expect(runWorkspacePortScanForTargetMock).toHaveBeenCalledTimes(2)
  })
})
