import React, { type Dispatch, type SetStateAction } from 'react'
import { ChevronRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { MemorySnapshot } from '../../../../shared/process-stats-types'
import type { UnifiedProjectGroup, UnifiedSessionRow } from './resource-usage-merge-types'
import type { SortOption } from './resource-usage-resource-tree'
import { ResourceTree } from './resource-usage-resource-tree'
import { AppSection } from './resource-usage-metrics'
import { ProcessMetricSortHeader } from './process-resource-metric-columns'
import type { getResourceMemoryMetricCopy } from './resource-memory-metric-copy'

export function renderResourceUsagePopoverBody({
  setPopoverBodyNode,
  unifiedRepos,
  resourceSnapshot,
  sortOption,
  setSortOption,
  memoryMetricCopy,
  collapsedRepos,
  toggleRepo,
  collapsedWorktrees,
  activeWorktreeId,
  toggleWorktree,
  navigateToWorktree,
  navigateToTab,
  deleteWorktree,
  handleKillSession,
  appCollapsed,
  setAppCollapsed,
  daemonUnreachable,
  runtimeHostNotices
}: {
  setPopoverBodyNode: (node: HTMLDivElement | null) => void
  unifiedRepos: UnifiedProjectGroup[]
  resourceSnapshot: MemorySnapshot | null
  sortOption: SortOption
  setSortOption: Dispatch<SetStateAction<SortOption>>
  memoryMetricCopy: ReturnType<typeof getResourceMemoryMetricCopy>
  collapsedRepos: Set<string>
  toggleRepo: (repoId: string) => void
  collapsedWorktrees: Set<string>
  activeWorktreeId: string | null
  toggleWorktree: (worktreeId: string) => void
  navigateToWorktree: (worktreeId: string) => void
  navigateToTab: (tabId: string, paneKey: string | null) => void
  deleteWorktree: (worktreeId: string) => void
  handleKillSession: (session: UnifiedSessionRow) => void
  appCollapsed: boolean
  setAppCollapsed: Dispatch<SetStateAction<boolean>>
  daemonUnreachable: boolean
  runtimeHostNotices: readonly string[]
}): React.JSX.Element {
  return (
    <div ref={setPopoverBodyNode} tabIndex={-1} className="flex h-[420px] flex-col outline-none">
      {(unifiedRepos.length > 0 || resourceSnapshot) && (
        <ProcessMetricSortHeader
          sortOption={sortOption}
          onSortOptionChange={setSortOption}
          memoryLabel={memoryMetricCopy.columnLabel}
          showUptimeColumn
          uptimeLabel={translate(
            'components.statusBar.processResourceMetricColumns.uptime',
            'Uptime'
          )}
        />
      )}

      <div className="flex-1 overflow-y-auto scrollbar-sleek">
        {runtimeHostNotices.map((notice) => (
          <div
            key={notice}
            className="border-b border-border/50 px-3 py-1.5 text-[11px] text-muted-foreground"
          >
            {notice}
          </div>
        ))}
        {unifiedRepos.length > 0 && (
          <ResourceTree
            repos={unifiedRepos}
            sortOption={sortOption}
            collapsedRepos={collapsedRepos}
            toggleRepo={toggleRepo}
            collapsedWorktrees={collapsedWorktrees}
            activeWorktreeId={activeWorktreeId}
            toggleWorktree={toggleWorktree}
            navigateToWorktree={navigateToWorktree}
            navigateToTab={navigateToTab}
            onDelete={deleteWorktree}
            onKillSession={handleKillSession}
          />
        )}

        {unifiedRepos.length === 0 && resourceSnapshot && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            {translate(
              'auto.components.status.bar.ResourceUsageStatusSegment.27a74f91f0',
              'Nothing running right now'
            )}
          </div>
        )}

        {resourceSnapshot && (
          <AppSection
            app={resourceSnapshot.app}
            isCollapsed={appCollapsed}
            onToggle={() => setAppCollapsed((v) => !v)}
          />
        )}

        {!resourceSnapshot && !daemonUnreachable && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            {translate(
              'auto.components.status.bar.ResourceUsageStatusSegment.888dad8c55',
              'Loading…'
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function renderResourceUsagePopoverFooter({
  handleOpenWorkspaceCleanup,
  orphanCount,
  handleKillOrphans
}: {
  handleOpenWorkspaceCleanup: () => void
  orphanCount: number
  handleKillOrphans: () => Promise<void>
}): React.JSX.Element {
  return (
    <div className="border-t border-border/50 px-3 py-2 shrink-0">
      <button
        type="button"
        onClick={handleOpenWorkspaceCleanup}
        className="relative inline-flex w-full items-center justify-center rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/60"
      >
        <span className="min-w-0 truncate px-4 text-center">
          {translate(
            'auto.components.status.bar.ResourceUsageStatusSegment.92924a14e3',
            'Clean up workspaces'
          )}
        </span>
        <ChevronRight className="absolute right-2.5 size-3.5 text-muted-foreground" aria-hidden />
      </button>
      {orphanCount > 0 ? (
        <button
          type="button"
          onClick={() => void handleKillOrphans()}
          className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/60"
        >
          {orphanCount === 1
            ? translate(
                'auto.components.status.bar.ResourceUsageStatusSegment.c7e3b1a0d9f2',
                'End {{value0}} orphan terminal',
                { value0: orphanCount }
              )
            : translate(
                'auto.components.status.bar.ResourceUsageStatusSegment.d8f4c2b1e0a3',
                'End {{value0}} orphan terminals',
                { value0: orphanCount }
              )}
        </button>
      ) : null}
    </div>
  )
}
