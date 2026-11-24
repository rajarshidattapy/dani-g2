# Dani Planner

A Rovo agent for Jira that turns a plain-language goal into an executable plan:
epics and stories with acceptance criteria, grounded in your project's existing work.

Built for Atlassian Codegeist 2026 (Apps for Software Teams).

Dan Lab's thesis: "if you can imagine the execution, it will be executed." Dani Planner
closes the gap between imagining and doing - you state the goal in Rovo, the agent reads
your Jira project, drafts a plan, and only after your approval creates the epics and
stories in Jira.

## What it does

1. **Plan a goal** - fetches your project's recent issues (via the `analyze-project`
   action) to understand existing work, then breaks your goal into epics and stories
   with acceptance criteria and dependencies. Nothing is created until you approve.
2. **Create the approved plan** - creates the epics and stories in Jira (via the
   `create-plan` action) and returns issue links.
3. **Review execution coverage** - compares your goal against existing issues and
   reports what's covered, missing, or stale.

## Technology

- Atlassian Forge (`nodejs20.x` runtime) with `rovo:agent` + two reusable `action`
  modules (`analyze-project` GET, `create-plan` CREATE) that other agents can also
  invoke as tools (Best Agents bonus).
- Jira REST API v3 via `@forge/api` (`read:jira-work`, `write:jira-work` scopes).

## Setup for judges

1. Install the app on your Jira site using the installation link provided in the
   Devpost submission.
2. In any Jira project, open Rovo chat and select the **Dani Planner** agent.
3. Try "Plan a goal for my project", e.g. "Launch a public API for our mobile app".
4. Approve the drafted plan, then ask it to create the plan in Jira.

## Repository structure

- `manifest.yml` - Forge app manifest (rovo:agent + actions + function handlers)
- `src/index.js` - the action handlers (`analyzeProject`, `createPlan`)
