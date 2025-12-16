# Agent Development Guidelines

## Build/Test Commands
- **Start benchmark**: `pnpm start <url>` or `node src/index.js <url>`
- **Agent mode**: `pnpm start --agent-mode http --agent-url <endpoint> --flow "<description>"`
- **Install deps**: `pnpm install` (uses pnpm as package manager)
- **Install Playwright**: `npx playwright install chromium`

## Code Style Guidelines

### Imports & Structure
- Use ES6 modules (`import`/`export`)
- Import order: Node.js built-ins → third-party → local modules
- Use absolute paths with `__dirname` for file system operations
- Export classes and functions individually

### Formatting & Naming
- **Classes**: PascalCase (`BenchmarkExecutor`)
- **Functions**: camelCase (`generateReport`, `executeFlow`)
- **Constants**: UPPER_SNAKE_CASE (`THRESHOLDS`)
- **Files**: kebab-case for names, `.js` extension
- Use 4-space indentation (consistent with codebase)
- Max line length: ~120 characters

### Error Handling
- Use try/catch blocks for async operations
- Throw descriptive errors with context
- Include console.error with formatted error blocks using box-drawing characters
- Always clean up resources (close browser) in catch blocks
- Use Promise.race for timeout handling

### Types & Documentation
- Use JSDoc comments for all exported functions/classes
- Document parameters with `@param {type} name - description`
- Document return values with `@returns {type} - description`
- Include usage examples in complex functions

### Performance & Best Practices
- Use Playwright's `addInitScript` for pre-page injection
- Wait for network activity to settle before proceeding
- Use proper wait strategies: `domcontentloaded`, `load`, custom conditions
- Monitor console errors and network failures
- Collect metrics via Performance Observer API and CDP

### Testing Patterns
- Test with simple URLs first: `https://example.com`
- Use complex sites for integration testing: `https://www.wikipedia.org`
- Verify browser installation with Playwright
- Test both simple and agent modes

### Agent Integration
- HTTP agents should return `{action, target, value}` format
- Support actions: `click`, `fill`, `navigate`, `wait`, `done`
- Provide detailed error context with page state and action history
- Use semantic element descriptions in locator functions