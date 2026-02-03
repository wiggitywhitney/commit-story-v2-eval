# Commit Story

**Your Engineering Journey, Remembered**

## What is Commit Story?

Commit Story transforms your git commits into rich journal entries by combining:

- **Your actual code changes** — the diff, the commit message, what you built
- **Conversations with your AI coding assistant** — the back-and-forth that led to decisions
- **The technical decisions and trade-offs you made** — captured automatically, not manually documented

Every time you commit, Commit Story generates a journal entry that tells the story of what you worked on and why. No workflow interruption, no manual documentation — just commit like you always do, and your engineering journal writes itself.

## Why Use It?

### For Yourself

- **Remember why** you made certain choices and how you overcame obstacles
- **See your growth** as a developer, not just a list of commits
- **Boost learning through reflection** — research shows [15 minutes of daily reflection improves performance by 20-25%](https://larryferlazzo.edublogs.org/files/2013/08/reflection-1di0i76.pdf)

### For Your Career

- **Evidence for performance reviews** and career advancement
- **Material for conference talks** and blog posts
- **Your engineering narrative**, documented as it happens

### For Your Team

- **Onboard new developers** with the actual story behind decisions
- **Meaningful retrospectives** with concrete examples
- **Preserve institutional knowledge** that usually gets lost

## Sample Journal Entry

Here's what a real journal entry looks like (from this repo):

```text
## 9:07:02 AM CST - Commit: 79a6c5a

### Summary
The developer implemented a new context formatting approach to improve journal entry
summaries in the commit-story system. They created a `formatContextForSummary()`
function in the journal-graph.js file that filters out AI assistant messages and
uses JSON.stringify to clearly present development session data.

The primary goal was to fix issues with summary generation, particularly preventing
the AI from echoing its own responses or including unnecessary process talk.

### Development Dialogue
> **Human:** "I would love to delete the February 3rd journal file in the Cluster
> Whisperer repo. And then recreate an entry for every commit, from today's oldest
> and newest. And then evaluate the full journal file."
> **Assistant:** "Great idea - that will give us a clean test of the fixes."

> **Human:** "Can we think of another way to do this besides prompt sprawl and
> harsh language? Would changing the role help? What's a more systematic way to
> solve this?"

### Technical Decisions
**DECISION: Implement V1-Style Context Formatting for Summaries** (Implemented)
  - V2 implementation was echoing AI responses in summaries
  - V1 used JSON-formatted context with self-documenting descriptions
  - Created formatContextForSummary() to filter out assistant messages
  - Used JSON.stringify to present context as clear DATA, not conversation

### Commit Details
- **Hash**: 79a6c5af84c0fc2e9b372271123358aec658c0c7
- **Author**: Whitney Lee
```

## v2 Architecture

This is a complete rebuild of [commit-story v1](https://github.com/wiggitywhitney/commit-story) with modern tooling:

| Component | v1 | v2 |
|-----------|----|----|
| AI Orchestration | Custom pipeline | **LangGraph** |
| LLM Provider | OpenAI | **Anthropic (Claude)** |
| Telemetry Schema | None | **OpenTelemetry Weaver** |

### Why the Rebuild?

v2 serves as a laboratory for exploring how AI automation reshapes telemetry practices. The codebase intentionally ships with **zero telemetry** — it's the "before" state for an AI instrumentation agent that will read OpenTelemetry conventions and instrument the code itself.

## Telemetry Schema

The `telemetry/registry/` directory contains an OpenTelemetry Weaver schema defining semantic conventions for commit-story. **No telemetry is implemented yet** — the schema exists so an AI agent can read it and instrument the codebase.

The schema:

- Imports official OTel semantic conventions (GenAI, VCS, RPC)
- Defines custom `commit_story.*` attributes for domain-specific telemetry

See [`docs/telemetry/`](docs/telemetry/) for the generated attribute documentation.

## Project Status

### What's Built

- Git post-commit hook trigger
- Git diff and commit data collection
- Claude Code chat history collection and filtering
- AI-powered journal generation (summary, dialogue, technical decisions)
- Journal file management (`journal/entries/YYYY-MM/YYYY-MM-DD.md`)
- MCP server for real-time context capture
- OpenTelemetry Weaver telemetry schema

### What's Next

- [ ] CI/CD pipeline (PRD #23)
- [ ] Telemetry Agent — AI that reads the Weaver schema and instruments this codebase
- [ ] npm package distribution

## License

AGPL-3.0
