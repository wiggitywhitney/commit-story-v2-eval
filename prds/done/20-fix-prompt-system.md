# PRD #20: Fix Prompt System for Quality Journal Output

## Overview

**Problem**: The v2 prompts are producing poor quality journal entries - AI process talk leaking into summaries ("Great question. Let's analyze..."), hallucinated dialogue quotes, formal robotic tone, and silent failures. The cluster-whisperer journal entries demonstrate these issues clearly.

**Solution**: Restore v1 prompt patterns (step-based architecture, role framing, guidelines on all nodes) and add schema verification functions to validate AI output against source data.

**Why This Matters**: Commit-story is installed in cluster-whisperer and producing unusable journal entries. The v1 implementation had working prompts - the v2 simplification removed critical patterns that prevented these issues.

## Success Criteria

1. Journal summaries describe what the developer did, not AI process talk
2. Dialogue quotes are verbatim from type:"user" messages in the chat
3. Technical decisions reference actual chat discussion, not inferred reasoning
4. Empty results returned instead of hallucinated content when context is insufficient
5. Third person voice ("the developer") maintained throughout
6. Casual, conversational tone (not formal/robotic)

## Root Cause Analysis

**What v1 had that worked:**
- Three-tier prompt composition (context → section prompt → guidelines) for ALL sections
- Step-based prompts with "INTERNAL PROCESS (do not output)" sections
- Role-based framing (Journalist for dialogue, Code Archivist for technical)
- Multi-layered anti-hallucination (role + rules + verification steps)
- Guidelines applied consistently to ALL nodes

**What v2 is missing:**
- Guidelines only applied to summaryNode, NOT technicalNode or dialogueNode
- No step-based architecture - prompts were simplified
- No role-based framing
- No verification steps before output
- No "INTERNAL PROCESS" sections to prevent AI from outputting its reasoning

**Evidence from cluster-whisperer:**
- Summary: "Great question. Let's analyze the implementation path." (AI process talk)
- Summary: "I'll create the PRD..." (AI meta-commentary)
- Summary: Decision trees and brainstorming captured as the actual work
- Dialogue: "[Dialogue extraction failed]" appearing repeatedly
- Technical: AI reasoning instead of extracted developer decisions

## Dependencies

None - this is a standalone fix to the existing prompt system.

## Design Decision: Step Enforcement Approach

**Chosen**: Prompt-based steps (v1 approach)
- Steps are instructions in prompt text with "INTERNAL PROCESS (do not output)" sections
- Simpler to implement, worked well in v1
- Combined with code-based verification functions as a safety net

**Fallback**: LangGraph programmatic execution
- If prompt-based approach doesn't produce consistent results, escalate to breaking each section into multi-node workflows
- Each step becomes a separate LangGraph node with state passed between them
- More complex but guarantees step execution order
- Example: `extractCandidates → filterNoise → verifyExists → formatOutput`

## Milestones

### Milestone 1: Restore Guidelines to All Nodes
**Status**: Complete ✅

Update `src/generators/journal-graph.js` to apply guidelines to technicalNode and dialogueNode, not just summaryNode.

**Changes:**
- Add `getAllGuidelines()` call to technicalNode
- Add `getAllGuidelines()` call to dialogueNode
- Ensure guidelines are prepended to system prompts in both nodes

**Done when**: All three section nodes include anti-hallucination and accessibility guidelines.

---

### Milestone 2: Restructure Dialogue Prompt
**Status**: Complete ✅

Update `src/generators/prompts/sections/dialogue-prompt.js` with v1-style architecture.

**Changes:**
- Add role statement: "You are a journalist finding quotes from the HUMAN developer"
- Add "INTERNAL PROCESS (do not output)" section with numbered steps
- Add verification step: ensure quotes come from type:"user" messages only
- Add critical rule: never quote type:"assistant" as human speech
- Maintain existing Zod schema integration

**Done when**: Dialogue prompt has role framing, step-based process, and clear internal/external sections.

---

### Milestone 3: Restructure Technical Decisions Prompt
**Status**: Complete ✅

Update `src/generators/prompts/sections/technical-decisions-prompt.js` with v1-style architecture.

**Changes:**
- Add role statement: "You are the Code Archivist, documenting REASONING and DECISIONS"
- Add "INTERNAL ANALYSIS (do not output)" section with numbered steps
- Add verification step: ensure reasoning appears in actual chat
- Add "WHAT TO AVOID" section including AI meta-commentary
- Maintain existing Zod schema integration

**Done when**: Technical decisions prompt has role framing, step-based process, and clear internal/external sections.

---

### Milestone 4: Strengthen Guidelines
**Status**: Complete ✅

Update guidelines files to be more explicit about preventing AI process talk.

**File: `src/generators/prompts/guidelines/index.js`**
- Add: "Never start with 'I'll create', 'Let me', 'I'll help', 'I'll output'"
- Add: "Never include your reasoning process or meta-commentary"
- Add: "Output ONLY your final content. No preamble, no process notes."

**File: `src/generators/prompts/guidelines/anti-hallucination.js`**
- Add: "NEVER quote type:'assistant' messages as if they were human speech"
- Add: "VERIFY quotes exist in the actual chat before including them"
- Add: "When quoting, use exact text from type:'user' messages only"

**Done when**: Guidelines explicitly address AI process talk and quote verification.

---

### Milestone 5: Add Schema Verification Functions
**Status**: Complete ✅

Add code-based verification in `src/generators/journal-graph.js` to validate AI output against source data.

**Functions to add:**
```javascript
verifyDialogueQuotes(result, messages)
- Get all type:"user" message content
- Filter quotes to only those that actually appear in user messages
- Return verified result

verifyTechnicalDecisions(result, messages)
- Get all message content
- Filter decisions to those with reasoning that appears in chat
- Return verified result
```

**Integration:**
- Call verifyDialogueQuotes after dialogueNode AI call, before formatting
- Call verifyTechnicalDecisions after technicalNode AI call, before formatting

**Done when**: Verification functions are implemented and integrated into the graph nodes.

---

### Milestone 6: Test in cluster-whisperer
**Status**: Complete ✅

Verified the fix works by testing with commit 8bd4b7f in cluster-whisperer.

**Test checklist:**
- [x] Summary starts with what changed, not AI process talk
- [x] No "I'll", "Let me", "Great question" in any section
- [x] Dialogue quotes appear verbatim in original type:"user" messages
- [x] Technical decisions reference actual chat discussion
- [x] Third-person voice ("the developer") maintained throughout
- [x] Empty results returned when insufficient context (not hallucinated content)

**Done when**: Generated journal entries pass all checklist items.

**Note**: Fixed schema bug during testing - assistant field needed to be optional (undefined) not just nullable (null).

---

## Non-Goals

- **Rewriting the summary prompt**: The summary prompt already has scenario-based logic and works reasonably well. Focus is on dialogue and technical decisions.
- **Changing the Zod schemas**: The structured output schemas are fine; the prompts feeding them need improvement.
- **LangGraph programmatic steps**: Only escalate to this if prompt-based approach fails.

## Files to Modify

| File | Changes |
|------|---------|
| `src/generators/journal-graph.js` | Add guidelines to all nodes; add verification functions |
| `src/generators/prompts/sections/dialogue-prompt.js` | Add Journalist role; step-based process; verification |
| `src/generators/prompts/sections/technical-decisions-prompt.js` | Add Code Archivist role; step-based process; verification |
| `src/generators/prompts/guidelines/index.js` | Strengthen anti-AI-process-talk rules |
| `src/generators/prompts/guidelines/anti-hallucination.js` | Add quote verification rules |

## Progress Log

**2026-02-03**: All milestones complete ✅
- Verified guidelines already applied to all nodes (M1)
- Verified dialogue prompt already has step-based architecture (M2)
- Added "Code Archivist" role to technical decisions prompt (M3)
- Strengthened anti-hallucination guidelines with type:"assistant" rules (M4)
- Added Zod schemas, verification functions, and structured output (M5)
- Tested in cluster-whisperer - fix verified working (M6)
- Fixed schema bug: assistant field needed optional() not just nullable()
