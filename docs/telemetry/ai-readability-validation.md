# AI Readability Validation

This document validates that an AI agent can successfully parse and interpret the commit-story Weaver schema.

## Test Date
2026-02-03

## Test Method

1. Run `weaver registry resolve -r ./telemetry/registry`
2. Provide the YAML output to Claude (claude-opus-4-5-20251101)
3. Verify Claude can identify all schema components

## Results: PASS ✅

### Schema Structure Discovery

Claude successfully identified the registry structure:

| Component | Discovered | Details |
|-----------|------------|---------|
| Attribute Groups | ✅ | 5 groups found |
| Attribute Names | ✅ | 31 total attributes |
| Attribute Types | ✅ | Primitives and enums |
| Requirement Levels | ✅ | required vs recommended |
| Enum Members | ✅ | Full value lists with descriptions |
| OTel Lineage | ✅ | Source groups and inheritance tracked |
| Stability | ✅ | All marked as `development` |

### Attribute Groups Parsed

| Group | Display Name | Count | Custom | OTel |
|-------|--------------|-------|--------|------|
| `commit_story.ai` | AI Generation | 10 | 1 | 9 |
| `commit_story.commit` | Commit | 6 | 4 | 2 |
| `commit_story.context` | Context Collection | 5 | 5 | 0 |
| `commit_story.filter` | Filter | 5 | 5 | 0 |
| `commit_story.journal` | Journal | 5 | 5 | 0 |

### Custom Attributes (20 total)

```text
commit_story.ai.section_type          enum    recommended
commit_story.commit.author            string  recommended
commit_story.commit.files_changed     int     recommended
commit_story.commit.message           string  recommended
commit_story.commit.timestamp         string  recommended
commit_story.context.messages_count   int     recommended
commit_story.context.sessions_count   int     recommended
commit_story.context.source           enum    recommended
commit_story.context.time_window_end  string  recommended
commit_story.context.time_window_start string recommended
commit_story.filter.messages_after    int     recommended
commit_story.filter.messages_before   int     recommended
commit_story.filter.tokens_after      int     recommended
commit_story.filter.tokens_before     int     recommended
commit_story.filter.type              enum    recommended
commit_story.journal.entry_date       string  recommended
commit_story.journal.file_path        string  recommended
commit_story.journal.quotes_count     int     recommended
commit_story.journal.sections         string[] recommended
commit_story.journal.word_count       int     recommended
```

### OTel Semantic Convention Attributes (11 total)

```text
gen_ai.operation.name      enum    required   (from attributes.gen_ai.common.client)
gen_ai.provider.name       enum    required   (from metric.gen_ai.client.operation.duration)
gen_ai.request.max_tokens  int     recommended (from attributes.gen_ai.inference.client)
gen_ai.request.model       string  required   (from attributes.gen_ai.common.client)
gen_ai.request.temperature double  recommended (from attributes.gen_ai.inference.client)
gen_ai.response.id         string  recommended (from attributes.gen_ai.inference.client)
gen_ai.response.model      string  recommended (from attributes.gen_ai.inference.client)
gen_ai.usage.input_tokens  int     recommended (from attributes.gen_ai.inference.client)
gen_ai.usage.output_tokens int     recommended (from attributes.gen_ai.inference.client)
vcs.ref.head.name          string  recommended (from entity.vcs.ref)
vcs.ref.head.revision      string  recommended (from entity.vcs.ref)
```

### Enum Values Discovered

#### commit_story.ai.section_type

| Value | Description |
|-------|-------------|
| `summary` | Daily summary section generation |
| `dialogue` | Developer dialogue extraction |
| `technical_decisions` | Technical decisions analysis |
| `context_synthesis` | Multi-source context synthesis |

#### commit_story.context.source

| Value | Description |
|-------|-------------|
| `claude_code` | Claude Code chat history from ~/.claude/projects/ |
| `git` | Git commit and diff data |
| `mcp` | MCP tool context capture |

#### commit_story.filter.type

| Value | Description |
|-------|-------------|
| `token_budget` | Filtering based on token limits |
| `noise_removal` | Removing tool calls and system messages |
| `sensitive_data` | Redacting sensitive information |
| `relevance` | Filtering by relevance to commit |

#### gen_ai.operation.name (OTel)

| Value | Description |
|-------|-------------|
| `chat` | Chat completion operation |
| `generate_content` | Multimodal content generation |
| `text_completion` | Text completions operation |
| `embeddings` | Embeddings operation |
| `create_agent` | Create GenAI agent |
| `invoke_agent` | Invoke GenAI agent |
| `execute_tool` | Execute a tool |

#### gen_ai.provider.name (OTel)

| Value | Description |
|-------|-------------|
| `anthropic` | Anthropic |
| `openai` | OpenAI |
| `aws.bedrock` | AWS Bedrock |
| `azure.ai.openai` | Azure OpenAI |
| (+ 10 more providers) | See resolved registry |

## AI Agent Capabilities Validated

Based on this test, an AI agent can:

1. **Discover all attributes** - Parse the groups array to find every attribute
2. **Understand types** - Distinguish primitives from enums, handle string arrays
3. **Identify requirements** - Know which attributes are required vs recommended
4. **Get enum values** - Extract valid values and their descriptions for enums
5. **Trace lineage** - Understand which attributes inherit from OTel conventions
6. **Read descriptions** - Use brief/note fields for context when instrumenting

## Implications for Phase 3 Telemetry Agent

The Telemetry Agent can use this schema to:

1. **Generate span attributes** - Know exactly what attributes to set on each span
2. **Validate values** - Ensure enum values match allowed members
3. **Prioritize instrumentation** - Focus on required attributes first
4. **Reference OTel standards** - Understand where custom conventions extend standard ones
5. **Document its work** - Use brief/note fields when explaining instrumentation choices

## Command Reference

```bash
# Resolve registry to YAML (default)
~/.cargo/bin/weaver registry resolve -r ./telemetry/registry

# Resolve to JSON file
~/.cargo/bin/weaver registry resolve -r ./telemetry/registry -f json -o resolved.json

# Validate registry
~/.cargo/bin/weaver registry check -r ./telemetry/registry
```
