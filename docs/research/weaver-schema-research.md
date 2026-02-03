# OpenTelemetry Weaver Schema Research

**Purpose**: Deep-dive research for PRD #19 - Creating a Weaver registry for commit-story's telemetry conventions.

**Date**: February 2026

---

## 1. Introduction

### What is OpenTelemetry Weaver?

OpenTelemetry Weaver is the official CLI tool for managing, validating, and generating artifacts from semantic convention registries. It treats telemetry as a **schema** that can be:

- Validated for correctness
- Resolved to expand references and merge dependencies
- Used to generate documentation and type-safe code
- Compared between versions for breaking changes
- Live-checked against actual OTLP telemetry streams

### Schema-Only Approach for commit-story

Weaver can generate code for Go, Rust, and Markdown, but **not JavaScript/TypeScript**. For commit-story, we use a **schema-only approach**:

1. Define conventions in Weaver YAML files
2. Import official OTel conventions as dependencies
3. Run `weaver registry resolve` to produce machine-readable output
4. The Phase 3 Telemetry Agent reads the resolved YAML/JSON directly

This approach is **language-agnostic** - the schema works for any codebase, regardless of language.

---

## 2. Registry Structure

### Directory Layout

A Weaver registry is a directory containing YAML files. The minimal structure:

```text
telemetry/registry/
├── registry_manifest.yaml    # Required: metadata and dependencies
├── attributes.yaml           # Custom attribute definitions
└── signals.yaml              # Span and metric definitions
```

For larger registries, you can split across multiple files. Weaver loads all `.yaml` files in the registry directory.

### File Purposes

| File | Purpose |
|------|---------|
| `registry_manifest.yaml` | Project metadata, version, and dependency declarations |
| `attributes.yaml` | Attribute group definitions (your custom `commit_story.*` attributes) |
| `signals.yaml` | Span and metric definitions that use those attributes |

---

## 3. registry_manifest.yaml Format

This file declares your registry's metadata and dependencies on other registries.

### Annotated Example

```yaml
# Registry metadata
name: commit_story
description: OpenTelemetry semantic conventions for the commit-story engineering journal
semconv_version: 0.1.0

# Base URL for schema files (not yet used by Weaver, reserved for future)
schema_base_url: https://commit-story.dev/schemas/

# Dependencies on other registries
dependencies:
  - name: otel
    registry_path: https://github.com/open-telemetry/semantic-conventions/archive/refs/tags/v1.37.0.zip[model]
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Registry identifier (used in attribute namespacing) |
| `description` | No | Human-readable description |
| `semconv_version` | Yes | Version of YOUR registry (semver format) |
| `schema_base_url` | No | Reserved for future telemetry schema v2 support |
| `dependencies` | No | List of external registries to import |

### Dependency Declaration

Dependencies let you import attributes from other registries (like the official OTel conventions):

```yaml
dependencies:
  - name: otel           # Alias for referencing this dependency
    registry_path: https://github.com/open-telemetry/semantic-conventions/archive/refs/tags/v1.37.0.zip[model]
```

**Important**: The `[model]` suffix specifies the subdirectory within the archive where the registry files are located. For OTel semantic conventions, the model files are in the `model/` directory.

### Version Pinning

Always pin to a specific tag (e.g., `v1.37.0`) rather than a branch. This ensures:
- Reproducible builds
- No surprise breaking changes
- Clear dependency tracking

---

## 4. Defining Custom Attributes

### Basic Attribute Group Structure

Attributes are defined in groups within `attributes.yaml`:

```yaml
groups:
  - id: registry.commit_story.commit    # Unique identifier for this group
    type: attribute_group               # Type: attribute_group for registry definitions
    display_name: Commit Attributes     # Human-readable name
    brief: Attributes describing git commit data
    attributes:
      - id: commit_story.commit.hash
        type: string
        stability: development
        brief: The full SHA hash of the commit
        examples: ["a1b2c3d4e5f6..."]

      - id: commit_story.commit.message
        type: string
        stability: development
        brief: The first line of the commit message
        examples: ["feat: add user authentication"]
```

### Attribute Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique attribute name (use namespace prefix like `commit_story.`) |
| `type` | Yes | Data type: `string`, `int`, `double`, `boolean`, `string[]`, or enum |
| `stability` | Yes | `development`, `experimental`, `stable`, or `deprecated` |
| `brief` | Yes | Short description (shown in docs) |
| `note` | No | Extended description with usage guidance |
| `examples` | No | Example values (improves docs and helps AI understand) |
| `deprecated` | No | Deprecation message if `stability: deprecated` |

### Supported Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `"hello"` |
| `int` | Integer | `42` |
| `double` | Floating point | `0.95` |
| `boolean` | True/false | `true` |
| `string[]` | Array of strings | `["a", "b"]` |
| enum | Constrained values | See below |

### Defining Enum Types

For attributes with a fixed set of values:

```yaml
attributes:
  - id: commit_story.filter.type
    stability: development
    type:
      members:
        - id: token_budget
          value: "token_budget"
          brief: Filtering based on token limits
        - id: noise_removal
          value: "noise_removal"
          brief: Removing tool calls and system messages
        - id: sensitive_data
          value: "sensitive_data"
          brief: Redacting sensitive information
    brief: The type of filtering operation applied
```

### Referencing Imported Attributes

To use attributes from a dependency (like official OTel conventions), use `ref:`:

```yaml
groups:
  - id: registry.commit_story.ai
    type: attribute_group
    brief: AI operation attributes combining OTel and custom
    attributes:
      # Reference official GenAI attributes
      - ref: gen_ai.request.model
      - ref: gen_ai.request.temperature
      - ref: gen_ai.usage.input_tokens
      - ref: gen_ai.usage.output_tokens

      # Define custom extensions
      - id: commit_story.ai.section_type
        type: string
        stability: development
        brief: The type of journal section being generated
        examples: ["summary", "dialogue", "technical_decisions"]
```

When you use `ref:`, Weaver resolves the attribute definition from the dependency registry.

### Overriding Requirement Levels

When referencing imported attributes, you can override their requirement level:

```yaml
attributes:
  - ref: gen_ai.request.model
    requirement_level: required    # Override the default
```

Requirement levels:
- `required` - Must always be present
- `recommended` - Should be present when applicable
- `opt_in` - Only present when explicitly enabled
- `conditionally_required` - Required under certain conditions (include a `note` explaining when)

---

## 5. Defining Signals (Spans and Metrics)

### Span Definition Structure

Spans are defined in `signals.yaml`:

```yaml
groups:
  - id: span.commit_story.ai.generate
    type: span
    stability: development
    brief: Represents an AI content generation operation
    span_kind: client           # client, server, internal, producer, consumer
    attributes:
      - ref: gen_ai.request.model
        requirement_level: required
      - ref: gen_ai.operation.name
        requirement_level: required
      - ref: commit_story.ai.section_type
        requirement_level: required
      - ref: gen_ai.usage.input_tokens
        requirement_level: recommended
      - ref: gen_ai.usage.output_tokens
        requirement_level: recommended
```

### Metric Definition Structure

```yaml
groups:
  - id: metric.commit_story.filter.tokens
    type: metric
    metric_name: commit_story.filter.tokens
    stability: development
    brief: Number of tokens before and after filtering
    instrument: histogram       # counter, histogram, gauge, updowncounter
    unit: "{token}"
    attributes:
      - ref: commit_story.filter.type
        requirement_level: required
      - id: commit_story.filter.phase
        type:
          members:
            - id: before
              value: "before"
            - id: after
              value: "after"
        brief: Whether this is the before or after count
        requirement_level: required
```

### Metric Instruments

| Instrument | Use Case |
|------------|----------|
| `counter` | Monotonically increasing count (e.g., total requests) |
| `histogram` | Distribution of values (e.g., latency, token counts) |
| `gauge` | Point-in-time value (e.g., current queue size) |
| `updowncounter` | Value that can increase or decrease (e.g., active connections) |

### Using extends for Attribute Inheritance

You can define base attribute groups and extend them:

```yaml
groups:
  # Base attributes for all AI operations
  - id: attributes.commit_story.ai.common
    type: attribute_group
    brief: Common attributes for all AI operations
    attributes:
      - ref: gen_ai.request.model
        requirement_level: required
      - ref: gen_ai.provider.name
        requirement_level: required
      - ref: gen_ai.operation.name
        requirement_level: required

  # Summary generation extends common
  - id: span.commit_story.ai.summary
    type: span
    extends: attributes.commit_story.ai.common
    brief: Generate journal summary section
    span_kind: client
    attributes:
      - id: commit_story.summary.word_count
        type: int
        brief: Word count of generated summary
        requirement_level: recommended
```

---

## 6. Importing from OTel Conventions

### Available Import Targets

The official OTel semantic conventions at v1.37.0 include:

| Namespace | Path in Registry | Relevant For |
|-----------|------------------|--------------|
| `gen_ai.*` | `model/gen-ai/` | AI operations |
| `rpc.*` | `model/rpc/` | MCP server operations |
| `error.*` | `model/error/` | Error attributes |
| `server.*` | `model/server/` | Server address/port |

### GenAI Attributes Available (v1.37.0)

Key attributes commit-story can use:

```yaml
# Request attributes
gen_ai.request.model           # Model name requested
gen_ai.request.temperature     # Temperature setting
gen_ai.request.max_tokens      # Max tokens to generate
gen_ai.operation.name          # Operation type (chat, etc.)

# Response attributes
gen_ai.response.model          # Model name returned
gen_ai.response.id             # Response ID
gen_ai.response.finish_reasons # Why generation stopped

# Usage attributes
gen_ai.usage.input_tokens      # Prompt tokens
gen_ai.usage.output_tokens     # Completion tokens

# Provider
gen_ai.provider.name           # anthropic, openai, etc.
```

### The imports Section

For importing signal groups (not just attributes):

```yaml
imports:
  metrics:
    - gen_ai.*              # Import all GenAI metrics
  events:
    - gen_ai.*              # Import all GenAI events
```

This is optional - you can also just use `ref:` to reference individual attributes.

---

## 7. The resolve Command Output

### Running weaver registry resolve

```bash
weaver registry resolve -r ./telemetry/registry -f yaml
```

This command:
1. Loads all YAML files in the registry
2. Downloads and parses dependencies
3. Resolves all `ref:` references to their full definitions
4. Validates the registry structure
5. Outputs a single consolidated YAML/JSON document

### Output Format Options

```bash
# YAML output (default, human-readable)
weaver registry resolve -r ./telemetry/registry -f yaml

# JSON output (easier for programmatic parsing)
weaver registry resolve -r ./telemetry/registry -f json

# Save to file
weaver registry resolve -r ./telemetry/registry -f yaml -o resolved-registry.yaml
```

### Resolved Output Structure

The resolved output is a flat list of all groups with references expanded:

```yaml
groups:
  # Custom attribute groups (fully defined)
  - id: registry.commit_story.commit
    type: attribute_group
    brief: Attributes describing git commit data
    attributes:
      - id: commit_story.commit.hash
        type: string
        stability: development
        brief: The full SHA hash of the commit
        examples: ["a1b2c3d4e5f6..."]
      # ... all attributes fully defined

  # Spans with attributes resolved
  - id: span.commit_story.ai.summary
    type: span
    stability: development
    brief: Generate journal summary section
    span_kind: client
    attributes:
      # Referenced attributes are now fully expanded
      - id: gen_ai.request.model
        type: string
        stability: development
        brief: The name of the GenAI model a request is being made to
        requirement_level: required
        examples: ["gpt-4"]
      # ... all other attributes
```

### Key Insight: What Gets Resolved

| In Source | In Resolved Output |
|-----------|-------------------|
| `ref: gen_ai.request.model` | Full attribute definition from OTel |
| `extends: base_group` | Attributes merged into the group |
| Enum members | Fully expanded with all values |
| Examples | Preserved for documentation |
| Requirement levels | Overrides applied |

---

## 8. What the AI Agent Needs to Parse

### Essential Information for Instrumentation

The Phase 3 Telemetry Agent needs to extract:

1. **Attribute Names and Types**
   - Full attribute ID (e.g., `commit_story.commit.hash`)
   - Data type for validation
   - Examples for understanding expected values

2. **Span Definitions**
   - Span ID pattern
   - Required vs optional attributes
   - Span kind (client, server, internal)

3. **Metric Definitions**
   - Metric name
   - Instrument type (counter, histogram, etc.)
   - Unit
   - Required attributes

4. **Descriptions**
   - `brief` for quick understanding
   - `note` for detailed guidance
   - Examples for context

### Example Parsing Logic (Pseudo-code)

```javascript
// Parse resolved registry
const registry = yaml.parse(resolvedYaml);

// Extract all custom attributes
const customAttributes = registry.groups
  .filter(g => g.type === 'attribute_group')
  .flatMap(g => g.attributes)
  .filter(a => a.id.startsWith('commit_story.'));

// Extract span definitions
const spans = registry.groups
  .filter(g => g.type === 'span');

// For each span, get required attributes
spans.forEach(span => {
  const required = span.attributes
    .filter(a => a.requirement_level === 'required')
    .map(a => a.id);
  console.log(`Span ${span.id} requires: ${required.join(', ')}`);
});
```

### Recommended AI Parsing Approach

1. **Load resolved YAML/JSON** into structured data
2. **Index by group ID** for quick lookup
3. **Categorize groups** by type (attribute_group, span, metric)
4. **Build attribute map** from ID to full definition
5. **For instrumentation**:
   - Find span definition for the operation
   - Get list of required/recommended attributes
   - Look up each attribute's type and examples
   - Generate code that sets these attributes

---

## 9. Recommended Schema for commit-story

### Attribute Group Structure

Based on v1's `standards.js` and the architecture report, commit-story needs four attribute groups:

```text
commit_story.commit.*    - Git commit attributes
commit_story.context.*   - Context collection attributes
commit_story.journal.*   - Journal generation attributes
commit_story.filter.*    - Filtering operation attributes
```

### commit_story.commit.* Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `commit_story.commit.hash` | string | Full SHA hash |
| `commit_story.commit.message` | string | First line of commit message |
| `commit_story.commit.author` | string | Author name |
| `commit_story.commit.author_email` | string | Author email |
| `commit_story.commit.timestamp` | string | ISO 8601 timestamp |
| `commit_story.commit.files_changed` | int | Number of files changed |

### commit_story.context.* Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `commit_story.context.sessions_count` | int | Number of Claude sessions found |
| `commit_story.context.messages_count` | int | Total messages collected |
| `commit_story.context.time_window_start` | string | Window start (ISO 8601) |
| `commit_story.context.time_window_end` | string | Window end (ISO 8601) |
| `commit_story.context.source` | enum | Source type (claude_code, git, etc.) |

### commit_story.journal.* Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `commit_story.journal.entry_date` | string | Journal entry date |
| `commit_story.journal.file_path` | string | Output file path |
| `commit_story.journal.sections` | string[] | Sections generated |
| `commit_story.journal.quotes_count` | int | Number of quotes extracted |
| `commit_story.journal.word_count` | int | Total word count |

### commit_story.filter.* Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `commit_story.filter.type` | enum | Filter type (token_budget, noise_removal, sensitive_data) |
| `commit_story.filter.messages_before` | int | Message count before filtering |
| `commit_story.filter.messages_after` | int | Message count after filtering |
| `commit_story.filter.tokens_before` | int | Token count before filtering |
| `commit_story.filter.tokens_after` | int | Token count after filtering |

### Span Definitions

| Span ID | Kind | Required Attributes |
|---------|------|---------------------|
| `span.commit_story.main` | internal | commit hash, timestamp |
| `span.commit_story.collect.git` | client | commit hash |
| `span.commit_story.collect.context` | client | time window, sessions count |
| `span.commit_story.filter` | internal | filter type, before/after counts |
| `span.commit_story.generate.summary` | client | gen_ai.*, section_type |
| `span.commit_story.generate.dialogue` | client | gen_ai.*, section_type |
| `span.commit_story.generate.technical` | client | gen_ai.*, section_type |
| `span.commit_story.save` | internal | file_path, sections |

---

## 10. Validation Commands

### Check Registry Validity

```bash
weaver registry check -r ./telemetry/registry
```

This validates:
- YAML syntax
- Schema compliance
- Reference resolution
- Semantic rules

### View Resolved Registry

```bash
weaver registry resolve -r ./telemetry/registry
```

### Generate Documentation

```bash
weaver registry generate -r ./telemetry/registry \
  --templates "https://github.com/open-telemetry/semantic-conventions/archive/refs/tags/v1.37.0.zip[templates]" \
  markdown docs/telemetry
```

### Live-Check Against Telemetry

Once commit-story emits telemetry:

```bash
weaver registry live-check -r ./telemetry/registry --inactivity-timeout 30
```

This validates actual OTLP data against the schema.

---

## 11. Quick Reference

### Essential Commands

```bash
# Validate registry
weaver registry check -r ./telemetry/registry

# Resolve and view (YAML)
weaver registry resolve -r ./telemetry/registry

# Resolve to JSON file
weaver registry resolve -r ./telemetry/registry -f json -o resolved.json

# Generate markdown docs
weaver registry generate -r ./telemetry/registry --templates PATH markdown OUTPUT_DIR
```

### Attribute Definition Template

```yaml
- id: namespace.category.name
  type: string | int | double | boolean | string[] | enum
  stability: development | experimental | stable | deprecated
  brief: Short description
  note: |
    Extended description with usage guidance.
  examples: ["example1", "example2"]
```

### Span Definition Template

```yaml
- id: span.namespace.operation
  type: span
  stability: development
  brief: What this span represents
  span_kind: client | server | internal | producer | consumer
  attributes:
    - ref: existing.attribute
      requirement_level: required | recommended | opt_in
    - id: new.attribute
      type: string
      brief: Description
      requirement_level: required
```

### Dependency Declaration Template

```yaml
dependencies:
  - name: otel
    registry_path: https://github.com/open-telemetry/semantic-conventions/archive/refs/tags/v1.37.0.zip[model]
```

---

## 12. Open Questions Answered

### Q: Registry location?

**Recommendation**: `telemetry/registry/` in the commit-story-v2 repo.

Rationale: Keeps the schema close to the code it describes. If cross-codebase use becomes important later, the registry can be extracted to a separate repo.

### Q: Which OTel version to pin?

**Recommendation**: v1.37.0

Rationale: This is the version documented in existing research, includes the current GenAI conventions, and aligns with what Datadog LLM Observability expects.

### Q: Separate repo for schema?

**Recommendation**: Keep in commit-story-v2 for now.

Rationale: The immediate goal is the KubeCon demo. Extraction to a separate repo can happen later if the Telemetry Agent needs to work on multiple codebases with different conventions.

---

## References

- [OpenTelemetry Weaver GitHub](https://github.com/open-telemetry/weaver)
- [Weaver Examples Repository](https://github.com/open-telemetry/opentelemetry-weaver-examples)
- [OTel Semantic Conventions](https://github.com/open-telemetry/semantic-conventions)
- [GenAI Conventions Spec](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Weaver Usage Documentation](https://github.com/open-telemetry/weaver/blob/main/docs/usage.md)
- [Define Your Own Schema Guide](https://github.com/open-telemetry/weaver/blob/main/docs/define-your-own-telemetry-schema.md)
