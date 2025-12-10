# AI-Driven Web Performance Benchmark Tool

A performance benchmarking tool that combines **Playwright automation**, **Performance Observer API**, **Chrome DevTools Protocol (CDP)**, and **AI agent integration** to measure and analyze web application performance through natural language-driven user flows.

## Features

- ✅ **Core Web Vitals Tracking** - LCP, INP, CLS with industry-standard thresholds
- ✅ **System Diagnostics** - TBT, JS Heap, Long Tasks, Network Resources
- ✅ **Formatted Reports** - Clean ASCII tables with pass/fail indicators
- 🤖 **AI Agent Integration** - Execute flows via natural language descriptions
- 📊 **Detailed Error Reporting** - Stop on error with full context

## Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd benchmark-agentic-tooling

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

### Basic Usage (No Agent)

Run a simple performance benchmark on any URL:

```bash
# Using pnpm
pnpm start https://example.com

# Using node
node src/index.js https://example.com
```

This will:
1. Navigate to the URL
2. Capture Core Web Vitals (LCP, INP, CLS)
3. Measure system diagnostics (TBT, JS Heap, Network)
4. Display a formatted report

## AI Agent Integration

The tool supports two agent integration modes:

### Option 1: HTTP API (Generic Agents)

Use this for Gemini, custom agents, or any AI that can make HTTP requests.

#### 1. Create Your Agent Endpoint

Your agent needs to expose an endpoint that:
- Receives: `{ snapshot, instruction, history }`
- Returns: `{ action, target, value }`

Example agent endpoint (Python/Flask):

```python
from flask import Flask, request, jsonify
import anthropic  # or openai, google.generativeai, etc.

app = Flask(__name__)
client = anthropic.Anthropic(api_key="your-api-key")

@app.route('/decide', methods=['POST'])
def decide_action():
    data = request.json
    snapshot = data['snapshot']
    instruction = data['instruction']
    history = data['history']
    
    # Ask your AI to decide the next action
    prompt = f"""
    You are controlling a web browser to execute this task: {instruction}
    
    Current page elements:
    {snapshot}
    
    Previous actions: {history}
    
    Return the next action as JSON:
    {{"action": "click|fill|navigate|wait|done", "target": "element description", "value": "optional value"}}
    
    Actions:
    - click: Click an element
    - fill: Fill an input (requires value)
    - navigate: Go to URL (requires value as URL)
    - wait: Wait for page load
    - done: Task complete
    """
    
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    
    # Parse AI response and return decision
    decision = parse_ai_response(response.content[0].text)
    return jsonify(decision)

if __name__ == '__main__':
    app.run(port=4000)
```

#### 2. Run the Benchmark

```bash
pnpm start --agent-mode http \
  --agent-url http://localhost:4000/decide \
  --flow "Navigate to example.com and click the More information link"
```

### Option 2: MCP (Claude Desktop/Code)

Use this if you have Claude Desktop or Claude Code installed.

#### 1. Install MCP SDK

```bash
npm install @modelcontextprotocol/sdk
```

#### 2. Create MCP Server

Create `src/agent/mcp-server.js`:

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Your MCP server implementation
// See MCP documentation: https://modelcontextprotocol.io
```

#### 3. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or equivalent:

```json
{
  "mcpServers": {
    "benchmark-tool": {
      "command": "node",
      "args": ["/absolute/path/to/benchmark-agentic-tooling/src/agent/mcp-server.js"]
    }
  }
}
```

#### 4. Run from Claude

In Claude Desktop, you can now use the benchmark tool as a custom command.

## Flow Description Examples

Write natural language descriptions of user flows:

### Simple Navigation
```bash
--flow "Navigate to wikipedia.org and click the English link"
```

### Form Filling
```bash
--flow "Go to example.com/login, fill email with test@test.com, fill password with test123, and click Login button"
```

### Complex Flow
```bash
--flow "Access site www.example.com and login with credentials test@test.com password test123. Navigate to create payment page and create a dummy payment. Don't use real or high values. Always await full page load before navigating to new page."
```

### Best Practices
- Be specific about element descriptions (e.g., "Login button" not just "button")
- Mention when to wait for page loads
- For sensitive data, note to use test/dummy values
- Break complex flows into clear steps

## Report Output

The tool generates formatted ASCII reports:

```
===============================================================
 BENCHMARK REPORT
 Target: https://example.com
 Browser: Chromium | Viewport: 1920x1080
===============================================================

 CORE WEB VITALS (UX)
 ---------------------------------------------------------------
 Metric    | Value       | Target      | Status
 ---------------------------------------------------------------
 LCP       | 764 ms      | < 2,500 ms  | ✅ PASS
 INP       | 0 ms        | < 200 ms    | ✅ PASS
 CLS       | 0.0000      | < 0.1       | ✅ PASS

 SYSTEM & RESOURCES
 ---------------------------------------------------------------
 Metric    | Value       | Context     | Status
 ---------------------------------------------------------------
 TBT       | 0 ms        | Blocking    | ✅ PASS
 JS Heap   | 1.13 MB     | Used        | ✅ PASS
 Long Tasks | 0           | Count       | ✅ PASS
 Requests  | 1           | Network     | -- OK
 Errors    | 1           | Console     | ⚠️  1 errors

 ⚠️  CONSOLE ERRORS
 ---------------------------------------------------------------
  1. Failed to load resource: the server responded with a status of 404 ()
     Location: https://example.com/favicon.ico

===============================================================
```

## Thresholds

Industry-standard thresholds for Core Web Vitals:

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | < 2.5s | 2.5s - 4.0s | > 4.0s |
| INP | < 200ms | 200ms - 500ms | > 500ms |
| CLS | < 0.1 | 0.1 - 0.25 | > 0.25 |
| TBT | < 200ms | 200ms - 600ms | > 600ms |

## Error Handling

The tool stops immediately on errors and provides detailed feedback:

- **What failed**: The specific action that caused the error
- **Why it failed**: Error message and context
- **Current page state**: URL, title, available elements
- **Action history**: All previous steps taken
- **No retries**: User must fix the issue and re-run

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Input                          │
│  • URL (simple mode)                                        │
│  • Natural language flow description (agent mode)           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Playwright Executor                      │
│  • Launches Chromium browser                                │
│  • Injects Performance Observer (observer.js)               │
│  • Establishes CDP session                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌──────────────────┐          ┌──────────────────────┐
│  Simple Mode     │          │   Agent Mode         │
│  • Navigate      │          │  • Generate snapshot │
│  • Wait          │          │  • Ask agent         │
│  • Extract       │          │  • Execute action    │
└────────┬─────────┘          │  • Repeat            │
         │                    └──────────┬───────────┘
         │                               │
         └───────────┬───────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Metrics Collection                       │
│  • Performance Observer: LCP, INP, CLS, Long Tasks          │
│  • CDP: TBT, JS Heap, Network Resources, Console Errors     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Report Generator                         │
│  • Format ASCII tables                                      │
│  • Apply thresholds                                         │
│  • Add status indicators                                    │
│  • Show detailed diagnostics                                │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### "Could not locate element"
- Check the element description matches what's on the page
- View the snapshot in error output to see available elements
- Try more specific descriptions (e.g., "Login Button" vs "Submit")

### "Agent endpoint returned 500"
- Verify your agent endpoint is running
- Check agent logs for errors
- Ensure response format matches: `{action, target, value}`

### "Flow exceeded maximum steps"
- Flow may be stuck in a loop
- Check agent decision logic
- Verify "done" action is returned when complete

### Browser not launching
- Run `npx playwright install chromium`
- Check Playwright installation

## Development

### Project Structure

```
benchmark-agentic-tooling/
├── src/
│   ├── agent/
│   │   ├── snapshot.js      # DOM snapshot generator
│   │   ├── locator.js       # Semantic element locator
│   │   ├── executor.js      # Flow executor
│   │   └── http-server.js   # HTTP API for agents
│   ├── observer.js          # Performance Observer injection
│   ├── executor.js          # Playwright controller
│   ├── reporter.js          # Report formatter
│   └── index.js             # Entry point
├── package.json
├── plan.md                  # Original project plan
└── README.md
```

### Running Tests

```bash
# Test simple benchmark
pnpm start https://example.com

# Test with complex site
pnpm start https://www.wikipedia.org
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
