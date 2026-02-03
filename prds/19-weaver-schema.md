# PRD #19: OpenTelemetry Weaver Schema for Commit Story

## Overview

**Problem**: The telemetry conventions for commit-story exist only in documentation and prior conversation context. There's no machine-readable schema that an AI agent can parse to discover and apply these conventions programmatically.

**Solution**: Define a formal OpenTelemetry Weaver schema for `commit_story.*` attributes, importing official OTel GenAI conventions as dependencies. This schema enables the Phase 3 Telemetry Agent to instrument code across any codebase that uses Weaver schemas.

**Why This Matters**: This is Phase 2 of the KubeCon EU 2026 talk preparation. The schema is the bridge between hand-written standards (Phase 1) and AI-driven instrumentation (Phase 3). Without a machine-readable schema, the Telemetry Agent cannot discover conventions in a standardized way.

## Success Criteria

1. A valid Weaver registry exists in this repository that passes `weaver registry check`
2. The schema defines all `commit_story.*` attributes used in the v2 codebase
3. The schema imports official OTel GenAI conventions (v1.37.0+) as dependencies
4. An AI agent can parse the resolved registry YAML to discover attributes, types, and requirements
5. Documentation is generated from the schema (proves the schema is complete)

## Dependencies

- **Phase 1 (Complete)**: commit-story v2 rebuilt with LangGraph, zero telemetry
- **Blocks Phase 3**: Telemetry Agent that reads schema and instruments code

## Milestones

### Milestone 1: Research - Weaver Deep Dive
**Status**: ✅ Complete

Research OpenTelemetry Weaver in depth to understand:
- [x] Registry structure and YAML format
- [x] How to define custom attribute groups
- [x] How to import official OTel conventions as dependencies
- [x] How `weaver registry resolve` outputs machine-readable data
- [x] What an AI agent needs to parse from the resolved registry

**Deliverable**: `docs/research/weaver-schema-research.md` with:
- [x] Weaver registry YAML structure (annotated examples)
- [x] Custom registry setup with OTel dependencies
- [x] Resolved registry output format (what the AI will read)
- [x] Recommended schema structure for commit-story

**Done when**: Research document exists and answers all questions above

---

### Milestone 2: Import OTel Semantic Conventions
**Status**: ✅ Complete

**Rationale**: Import standard conventions FIRST to understand what's already covered before defining custom attributes.

**Steps**:
1. [x] Review `docs/research/weaver-schema-research.md` - understand OTel dependency configuration and semconv imports
2. [x] Create `telemetry/registry/` directory structure with `registry_manifest.yaml`
3. [x] Configure registry to import official OTel semantic conventions (v1.37.0)
4. [x] Import GenAI conventions (gen_ai.*) - needed for AI generation spans
5. [x] Check for VCS/git conventions that might already exist
6. [x] Check for any other relevant conventions (rpc.* for MCP operations)
7. [x] Run `weaver registry resolve` to see what's available
8. [x] Document which semconvs commit-story will use vs what gaps need custom attributes

**Deliverable**: Registry with OTel dependencies configured, documented list of semconvs to use

**Done when**: `weaver registry resolve` outputs OTel conventions and gaps are identified

**Findings**:
- **GenAI (`gen_ai.*`)**: Full coverage for AI operations - request.model, operation.name, usage tokens, provider.name (includes `anthropic`)
- **VCS (`vcs.*`)**: Covers branch/revision only (`vcs.ref.head.name`, `vcs.ref.head.revision`) - does NOT cover commit message, author, timestamp, files changed
- **RPC (`rpc.*`)**: Available but MCP not in `rpc.system` enum (too new)

---

### Milestone 3: Define commit_story.* Custom Attributes
**Status**: ✅ Complete

**Rationale**: Only define custom attributes for gaps NOT covered by OTel semantic conventions.

**Steps**:
1. [x] Review `docs/research/weaver-schema-research.md` - understand registry structure and YAML format
2. [x] Review Milestone 2 output - what semconvs are available vs what's missing
3. [x] Define custom attribute groups ONLY for app-specific concepts:
   - `commit_story.commit.*` - message, author, author_email, timestamp, files_changed (VCS doesn't cover these)
   - `commit_story.context.*` - sessions_count, messages_count, time_window_start/end, source
   - `commit_story.journal.*` - entry_date, file_path, sections, quotes_count, word_count
   - `commit_story.filter.*` - type (enum), messages_before/after, tokens_before/after
   - `commit_story.ai.*` - section_type (extends gen_ai with journal-specific operations)
4. [x] Create attribute group definitions that reference both OTel and custom attributes
5. [x] Run `weaver registry check` to validate - passes with no errors

**Deliverable**: `telemetry/registry/attributes.yaml` with custom attributes

**Done when**: `weaver registry check` passes, registry uses semconvs where available

---

### Milestone 4: Generate Documentation from Schema
**Status**: ✅ Complete

**Steps**:
1. [x] Review `docs/research/weaver-schema-research.md` - understand Weaver's documentation generation capabilities and template options
2. [x] Configure Weaver templates for markdown output
3. [x] Run `weaver registry generate` with markdown templates
4. [x] Review generated documentation for completeness
5. [x] Place output at `docs/telemetry/` (directory structure per OTel convention)

**Prerequisites**: Milestones 2 and 3 complete

**Deliverable**: `docs/telemetry/` directory with auto-generated Weaver documentation

**Done when**: Generated docs accurately describe all attributes

**Implementation Notes**:
- Uses official OTel semantic conventions templates from v1.37.0
- Generates directory structure matching OTel's own documentation format
- Includes attribute tables, enum values, stability badges, and detailed footnotes
- Regeneration command documented in `docs/telemetry/README.md`

---

### Milestone 5: Validate AI Readability
**Status**: Not Started

**Steps**:
1. [ ] Review `docs/research/weaver-schema-research.md` - understand resolved registry output format and what AI needs to parse
2. [ ] Run `weaver registry resolve --registry ./telemetry/registry`
3. [ ] Capture the output (YAML/JSON)
4. [ ] Have Claude parse it and describe the available conventions
5. [ ] Verify Claude can identify attribute names, types, requirements, and descriptions
6. [ ] Document the test results

**Prerequisites**: Milestone 4 complete

**Deliverable**: Documented test showing AI can read and interpret the schema

**Done when**: AI successfully parses schema and can describe conventions accurately

---

## Non-Goals

- **Code generation**: We are NOT generating JavaScript/TypeScript code from the schema. The AI agent will read the schema directly.
- **Go rewrite**: We are NOT rewriting commit-story in Go to use Weaver's code generation.
- **Telemetry implementation**: Adding actual telemetry to commit-story v2 is Phase 3, not this PRD.

## Technical Notes

### Weaver Language Support (as of February 2026)
Weaver generates code for: Go, Rust, Markdown, HTML. JavaScript/TypeScript templates do not exist. This PRD uses the schema-only approach where the AI reads YAML directly.

### Talk Abstract Alignment
The abstract says: "a live demonstration integrating OpenTelemetry Weaver to formalize standards, enabling the Telemetry Agent to function across multiple codebases."

This PRD delivers:
- ✅ Integrating Weaver (the schema)
- ✅ Formalizing standards (YAML definitions)
- ✅ Enabling cross-codebase use (schema is language-agnostic)

## Open Questions

1. Should the registry live in `telemetry/registry/` or a different location?
   - **Answer**: `telemetry/registry/` - keeps schema close to code it describes
2. What version of OTel semantic conventions should we pin to?
   - **Answer**: v1.37.0 - aligns with existing research and Datadog LLM Observability
3. Should we create a separate repo for the schema (for true cross-codebase use) or keep it in commit-story-v2?
   - **Answer**: Keep in commit-story-v2 for now; can extract later if needed

## Progress Log

- **2026-02-03**: Milestone 1 complete - Created `docs/research/weaver-schema-research.md` with comprehensive Weaver deep-dive covering registry structure, custom attributes, OTel dependencies, resolved output format, and recommended schema for commit-story
- **2026-02-03**: Swapped Milestones 2 and 3 - Import OTel semconvs FIRST, then define custom attributes only for gaps. This ensures we use standard conventions wherever possible.
- **2026-02-03**: Milestones 2 & 3 complete - Created `telemetry/registry/` with `registry_manifest.yaml` (OTel v1.37.0 dependency) and `attributes.yaml` (5 attribute groups). Validated GenAI, VCS, RPC convention imports. Registry passes `weaver registry check`. Documented Weaver CLI in `.claude/CLAUDE.md`.
- **2026-02-03**: Milestone 4 complete - Generated documentation using `weaver registry generate` with OTel v1.37.0 markdown templates. Output in `docs/telemetry/` directory structure. Covers all 5 attribute groups (32 total attributes), includes enum values, stability badges, and OTel attribute footnotes.
