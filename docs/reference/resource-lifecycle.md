# Task resource lifecycle

Read before starting agents, background processes, servers, browsers or MCP sessions, when accepting worker results, and before finishing or handing off a task that used them. This is an agent policy, not an installed process collector.

## Acquire, release, verify

1. **Acquire with ownership.** For each resource that can outlive its tool call, keep a compact record in task notes: purpose, owner, execution host, exact runtime handle or process identity, and supported shutdown operation. Record whether it was created for this task or borrowed. For processes, retain PID and start identity, plus relevant listening ports; a name or port alone is insufficient. Synchronous commands that exit within their call need no separate inventory.
2. **Assign cleanup.** Tell each worker to apply this policy, release its own temporary resources before returning, and report what remains. The coordinator owns release of the worker session after accepting its result. On handoff, transfer the resource record to an identified next owner through the supported handoff mechanism; resources outside that handoff remain the current owner's responsibility.
3. **Release after last use.** As soon as a resource has no remaining consumer, use its supported shutdown operation. Keep it live only for a concrete pending step, an accepted handoff, or a user-requested service or preview. Revisit retention when that need ends. Low CPU usage, silence, elapsed time, and an open port do not establish completion or abandonment.
4. **Verify release.** Check the exact handle or process identity after shutdown; check relevant ports for remaining owned listeners. An interrupt, closed tab, completed task, or successful shutdown request alone does not prove release. Inspect any remaining owned children even if the parent exited. Reconcile ambiguous results through the owning runtime before repeating an action.
5. **Account before returning.** Every recorded resource must be verified released, retained for a named purpose and owner, or unresolved with the missing capability or evidence stated. Report remaining resources and cleanup failures to the user, with safe identifiers and the next action. Carry retained records across turns and context handoffs. A task with no such resources needs no process sweep or cleanup report.

## Resource-specific release

| Resource | Required behavior |
|---|---|
| Subagents and Orca workers | Accept and preserve results, then use the provider's supported release operation unless an immediate follow-up or explicit retention applies. Follow the installed Orca orchestration contract for supervised workers. If native agents expose only interruption, distinguish interruption from disposal and report that limitation. |
| Servers, watchers, terminals and background jobs | Release task-owned processes regardless of runtime: Python, Node, Bun, shell or another executable. Prefer the manager's stop operation or graceful shutdown; wait for bounded exit confirmation. Escalate only against a revalidated, exclusively task-owned process or process group when graceful shutdown fails and the task no longer needs it. Preserve files, worktrees and saved outputs. |
| Playwright and other browsers | Close task-created pages, contexts and browser instances through their owning API. On a borrowed browser, close only task-created surfaces. Check separately owned drivers or browser servers after closing their clients. Preserve previews still requested by the user. |
| MCP | Release task-owned sessions, clients, browser contexts and temporary artifacts through exposed lifecycle tools. Stop an MCP server only when exclusive task ownership and absence of other consumers are established. Invoking an MCP tool grants no ownership of its server. Keep shared or runtime-managed servers under their manager's control; if an owned resource has no shutdown API, report it instead of killing its host. |

## Ownership boundaries

Target exact, currently verified identities on the execution host. Preserve pre-existing services, user sessions, other tasks' resources, the active coordinator, and the Orca/runtime infrastructure. Never terminate by executable name, port number alone, or a workspace-wide sweep. When ownership or live consumers cannot be established, preserve the resource and report the uncertainty.

Resource records contain lifecycle metadata, not credentials, environment dumps or raw command lines that may contain secrets. Inspect only the information needed to prove ownership and release.
