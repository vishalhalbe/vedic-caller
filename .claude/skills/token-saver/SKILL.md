# Skill: Token Saver (JyotishConnect)

Adapted from [crichalchemist/token-saver-skill](https://github.com/crichalchemist/token-saver-skill).

## Purpose

Optimize Claude token usage on the vedic-caller project by delegating routine coding tasks to free AI models via OpenCode MCP, reserving Claude's capacity for complex business logic, financial safety, and security.

## When to Use

Invoke when asked to:
- Generate boilerplate Flutter widgets or screens
- Scaffold Express CRUD routes
- Create Dart/TypeScript type definitions or interfaces
- Write empty test file structures
- Add API documentation comments
- Update `pubspec.yaml` dependencies

## Delegation Workflow

```
1. Identify task type (see decision matrix below)
2. If delegatable → gather context (file, types, API shape)
3. Invoke free model via: opencode run --model <model> "<prompt>"
4. Validate output (syntax, types, naming conventions)
5. Apply to codebase
```

## Decision Matrix

### Delegate to Free Models

| Task | Model | Example |
|------|-------|---------|
| Flutter stateless widget | GitHub Copilot GPT-4.1 | `WalletBalanceCard`, `AstrologerTile` |
| Flutter screen scaffold | GitHub Copilot GPT-4.1 | New screen with loading/error states |
| Express CRUD route | GLM-4 | `/astrologer` GET with pagination |
| Dart data class | GitHub Copilot GPT-4.1 | `Astrologer`, `CallSession` models |
| Jest test scaffold | GLM-4 | Empty describe/it blocks for a new route |
| API doc comments | GLM-4 | JSDoc for route handlers |
| pubspec dependencies | GitHub Copilot GPT-4.1 | Adding a new Flutter package |

### Keep in Claude

| Task | Reason |
|------|--------|
| `walletEngine.js` changes | Atomic DB transactions — financial safety |
| `billingEngine.js` changes | Billing formula correctness |
| `authMiddleware.js` changes | JWT security |
| `webhook_v2.js` changes | HMAC signature verification |
| `callLifecycle.js` changes | Session state + billing trigger |
| RLS policy changes | Data isolation security |
| Any code involving `atomicDeduct` | Race condition risks |
| Error handling for payment flows | Financial accuracy |
| Idempotency logic | Duplicate payment prevention |

## Model Selection

```
GitHub Copilot GPT-4.1:
  Best for: Flutter/Dart, TypeScript, React-style components
  Use when: Creating widgets, screens, Dart classes

GLM-4 (Zhipu AI):
  Best for: Node.js, Python, documentation
  Use when: Express routes, service stubs, JSDoc
```

## Guardrails

**Stop and keep in Claude if the task involves:**
- Any `wallet`, `billing`, `payment`, or `transaction` logic
- Authentication, JWT, or session management
- HMAC signature computation or verification
- Database migrations or RLS policies
- Decisions about architecture (not just implementation)
- Error handling in financial flows
- Anything a senior engineer should review

## Setup

Requires OpenCode MCP server configured in `.mcp.json`:
```json
{
  "mcpServers": {
    "opencode": {
      "command": "opencode",
      "args": ["mcp"]
    }
  }
}
```

See [token-saver-skill README](https://github.com/crichalchemist/token-saver-skill) for full setup.

## Estimated Savings

On typical vedic-caller development sessions:
- Flutter widget generation: ~2,000 tokens → free model
- CRUD route scaffolding: ~1,500 tokens → free model
- Test file creation: ~1,000 tokens → free model
