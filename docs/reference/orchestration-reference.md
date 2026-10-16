# Delegation and worker lifecycle

Read when delegating work or receiving an explicit worker assignment. A structured user prompt is not itself a worker assignment.

## Decide whether to delegate

Keep cohesive, small work with the current agent. Delegate a bounded unit when it has an observable acceptance check and the saved effort or independent evidence justifies dispatch, review, and cleanup. The coordinator owns ambiguity, architecture, integration, and the final result.

For substantial multi-agent work, use the installed `frontier-orchestrator` skill when available. Follow its routing and lifecycle for that run instead of duplicating them here. Preserve the user's root model and effort. Select workers from capabilities available in the current runtime; model names and CLI flags are looked up when dispatching.

## Dispatch and supervise

1. Assign one owner per write surface. State the goal, source paths, allowed edits, constraints, acceptance evidence, and return channel. Tell the worker it shares the checkout and must preserve others' edits.
2. Use the current worktree. Confirm that the transport supports completion, steering, and cleanup before spawning. Prefer native agents when their lifecycle is complete; otherwise use Orca's supervised worker commands supported by the installed CLI.
3. Continue independent work while waiting for completion notifications or one bounded blocking wait. On a timeout, inspect bounded output and steer or take over using the new evidence.
4. Inspect the return and its artifacts against the assignment. When taking over, stop the worker before editing its owned files.
5. Apply [resource lifecycle](resource-lifecycle.md) when spawning workers, accepting their results, and finishing or handing off the task. Include the worker's cleanup responsibility in its assignment and reconcile its resource report before releasing its terminal.

When Orca is the selected transport, consult the installed `orchestration` skill for its run/task/worker contract and the installed `orca-cli` skill for terminal and workspace operations as needed. Discover current operations with `orca orchestration --help` and each selected subcommand's help. Do not run worktree-wide cleanup to close a single worker. A completed task status alone does not prove its terminal was released.

## Worker contract

Execute only the assigned unit. Delegate further only when the assignment explicitly permits it.

- Make focused changes in the owned files and accommodate others' concurrent edits.
- Verify using the owning project's guide and a focused behavior check appropriate to its language. `check-diff` is an option only where the project supports it; lack of TypeScript is not a blocker.
- Return through the assigned channel, in English, with the result, changed paths, checks actually run, and remaining limitations. If blocked, name the missing fact or capability and what you tried.
- Before returning the result, release dispensable resources you created and identify any retained resources and their next owner under [resource lifecycle](resource-lifecycle.md). After returning, stop work; the coordinator owns integration and release of your agent session.

Default return format (at most 12 lines unless the assignment needs more evidence):

```text
DONE | BLOCKED
- Result and changed paths
- Verification commands and observed outcomes
- Remaining risk or exact blocker
```

For work spanning sessions, save self-contained assignments with dependencies and a handoff containing decisions, paths, evidence, and the next action. Use context reset or handoff commands only when the runtime supports them and the state has been preserved.
