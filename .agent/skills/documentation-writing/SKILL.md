---
name: documentation-writing
description: Create world-class, production-grade technical documentation with exceptional clarity and precision. Use this skill when the user asks to write READMEs, API references, guides, or code comments. Generates professional, accessible content that rivals top-tier tech companies.
license: Complete terms in LICENSE.txt
---

This skill guides the creation of authoritative, user-centric technical documentation. Produce content that is not merely informational but is an engineered product in itself—optimized for clarity, scannability, and utility.

The user provides documentation requirements: a README, an architectural overview, an API guide, or inline comments. They may include context about the target audience (developers, stakeholders) or the complexity of the feature.

## Documentation Strategy

Before writing, establish the context and commit to a USER-FIRST strategy:
- **Audience**: Who is reading this? (Junior Developers, DevOps Engineers, CTOs). Adjust technical depth accordingly.
- **Objective**: What is the specific "Job to be Done"? (e.g., "Deploy in 5 minutes," "Debug a specific error," "Understand the data model").
- **Voice**: authoritative yet accessible. Professional, direct, and concise. Avoid academic jargon; prefer clear, actionable language found in documentation from industry leaders like Stripe, Vercel, or Linear.
- **Value**: Why does this document exist? It must reduce cognitive load, not add to it.

**CRITICAL**: Every sentence must earn its place. If it does not clarify a concept or guide an action, remove it. Clarity is the ultimate metric of success.

Then implement documentation that is:
- **Structurally Sound**: Logical hierarchy with clear navigation.
- **Action-Oriented**: Focus on what the user needs to *do*.
- **Single Source of Truth**: Aligned strictly with the code and official platform behaviors.
- **Visually Scannable**: Heavy use of formatting tools to break up text.

## Writing Standards & Guidelines

Focus on:
- **Structure & Hierarchy**: Use consistent heading levels (`#`, `##`, `###`) to create a predictable information architecture. Place the most critical information (prerequisites, quick starts) at the top. Use Tables of Contents for long documents.
- **Language & Tone**: Use the **Active Voice** exclusively (e.g., "Install the package" not "The package should be installed"). Be direct. Remove filler words like "basically," "simply," "just," and "fairly."
- **Code Examples**: Provide realistic, copy-pasteable code blocks. Ensure examples include necessary imports and context. Use meaningful variable names (`user_id` instead of `foo`). Annotate complex lines with brief comments.
- **Formatting**: Utilize bolding for UI elements and key terms. Use backticks for code references within prose (e.g., "Set the `debug` flag to `true`"). Use callouts/blockquotes for warnings or tips (e.g., `> ⚠️ **Note**:`).
- **Visuals & Diagrams**: Where text fails, use Mermaid diagrams or describe where a screenshot/diagram is necessary. Visualizing data flow or architecture is often more effective than paragraphs of explanation.

NEVER use vague, passive, or apologetic language. Avoid "wall of text" paragraphs; break them into bullet points or steps. Never assume user knowledge without providing a link or reference to the prerequisite concept.

**IMPORTANT**: Verify accuracy. Documentation that describes a different reality than the code is worse than no documentation. Match the documentation version to the code version.

## Documentation Anti-Patterns

- **The "Simple" Trap**: Avoid words like "easy," "simple," or "straightforward." What is simple to you may be complex to the user. State the difficulty objectively or just describe the steps.
- **Lazy Linking**: Do not just say "Check the official docs." Provide the specific context *and* the link.
- **Orphaned Code**: Never provide a code snippet without explaining where it goes or what file it belongs to.
- **Assumed Environment**: Explicitly state prerequisites (e.g., "Requires Node.js v18+"). Do not assume the user's local environment matches yours.

Remember: Great documentation is an empathy exercise. Anticipate where the user will stumble and build a bridge over that gap before they even reach it.