import {
  getProcessOutputFields,
  iterateProcessOutputLines
} from '../../shared/process-output-field-scanner'
import { parsePsElapsedTimeToSeconds } from '../../shared/ps-elapsed-time'

/** One row from the host-wide process listing. */
export type ProcRow = {
  pid: number
  ppid: number
  /** Percent of one core (may exceed 100 on multi-core). */
  cpu: number
  /** Resident memory in bytes. */
  memory: number
  /** Committed bytes, resident or paged out. Absent when the host cannot report it. */
  privateMemory?: number
  /** Seconds since the process started; undefined when unavailable. */
  uptimeSeconds?: number
}

/** Exported for tests: parses `ps -eo pid=,ppid=,pcpu=,rss=,etime=` output. */
export function parsePsOutput(stdout: string): ProcRow[] {
  const rows: ProcRow[] = []
  for (const line of iterateProcessOutputLines(stdout)) {
    const fields = getProcessOutputFields(line, 5)
    if (fields.length < 4) {
      continue
    }
    const pid = Number.parseInt(fields[0], 10)
    const ppid = Number.parseInt(fields[1], 10)
    const cpu = Number.parseFloat(fields[2])
    const rssKb = Number.parseInt(fields[3], 10)
    if (Number.isNaN(pid) || Number.isNaN(ppid)) {
      continue
    }
    rows.push({
      pid,
      ppid,
      cpu: Number.isFinite(cpu) && cpu > 0 ? cpu : 0,
      memory: Number.isFinite(rssKb) && rssKb > 0 ? rssKb * 1024 : 0,
      uptimeSeconds: fields[4] ? parsePsElapsedTimeToSeconds(fields[4]) : undefined
    })
  }
  return rows
}
