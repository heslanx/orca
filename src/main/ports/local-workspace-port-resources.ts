import { getProcessOutputFields } from '../../shared/process-output-field-scanner'
import { parsePsElapsedTimeToSeconds } from '../../shared/ps-elapsed-time'
import { enumerateWindowsProcessResources } from '../memory/windows-process-resource-collector'
import { readWindowsProcessTable } from '../windows/windows-process-table'
import { runPortScanCommand } from './port-scan-command-client'
import type { ProcessMetadata } from './local-workspace-port-scan-state'

export async function loadWindowsProcessMetadata(
  pids: Set<number>
): Promise<Map<number, ProcessMetadata>> {
  const result = new Map<number, ProcessMetadata>()
  if (pids.size === 0) {
    return result
  }
  try {
    // Why the native snapshot: attributing ports used to fork a powershell.exe
    // per scan just to turn PIDs into names. That is a ~700ms cold start, a
    // conhost window, and one more thing a Group Policy can block -- for data
    // the panel treats as optional anyway.
    for (const row of await readWindowsProcessTable()) {
      if (pids.has(row.pid)) {
        result.set(row.pid, {
          processName: row.name,
          commandLine: row.command || undefined,
          uptimeSeconds: row.creationTimeMs
            ? Math.max(0, Math.floor((Date.now() - row.creationTimeMs) / 1000))
            : undefined
        })
      }
    }
  } catch {
    // Process metadata is optional; port rows still render without attribution.
  }
  // Use the resource collector's existing backend instead of adding two independent PowerShell queries.
  try {
    for (const row of await enumerateWindowsProcessResources()) {
      if (pids.has(row.pid)) {
        result.set(row.pid, {
          ...result.get(row.pid),
          cpu: row.cpu,
          memory: row.memory,
          uptimeSeconds: row.uptimeSeconds ?? result.get(row.pid)?.uptimeSeconds
        })
      }
    }
  } catch {
    // Resource values are optional; preserve native process attribution.
  }
  return result
}

/** Batched `ps -o pcpu=,rss=` lookup; cheaper than one call per listening pid. */
export async function loadUnixProcessResourceUsage(
  pids: Set<number>
): Promise<Map<number, { cpu?: number; memory?: number; uptimeSeconds?: number }>> {
  const result = new Map<number, { cpu?: number; memory?: number; uptimeSeconds?: number }>()
  const pidList = Array.from(pids).join(',')
  if (!pidList) {
    return result
  }
  const output = await runPortScanCommand('ps', [
    '-p',
    pidList,
    '-o',
    'pid=',
    '-o',
    'pcpu=',
    '-o',
    'rss=',
    '-o',
    'etime='
  ]).catch(() => null)

  for (const line of output?.stdout.split('\n') ?? []) {
    const fields = getProcessOutputFields(line, 4)
    if (fields.length < 4) {
      continue
    }
    const pid = Number.parseInt(fields[0], 10)
    result.set(pid, processResourceUsageFromPsFields(fields[1], fields[2], fields[3]))
  }
  return result
}

/** Parses `ps -o pcpu=,rss=,etime=` fields; tolerates a locale decimal comma in pcpu. */
export function processResourceUsageFromPsFields(
  pcpuField: string,
  rssField: string,
  etimeField?: string
): { cpu?: number; memory?: number; uptimeSeconds?: number } {
  const cpu = Number.parseFloat(pcpuField.replace(',', '.'))
  const rssKb = Number.parseInt(rssField, 10)
  return {
    cpu: Number.isFinite(cpu) ? cpu : undefined,
    memory: Number.isFinite(rssKb) ? rssKb * 1024 : undefined,
    uptimeSeconds: etimeField ? parsePsElapsedTimeToSeconds(etimeField) : undefined
  }
}
