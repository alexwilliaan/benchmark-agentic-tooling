# Universal Agent Integration Guide

Your benchmark tool now supports **universal agent integration** through multiple interfaces. Choose the one that works best for your agent:

## 🚀 Quick Start

### 1. MCP Protocol (Recommended for MCP-compatible agents)
```bash
# Generic MCP server
node src/agent/generic-mcp-server.js
```

### 2. HTTP API (For any agent that can make HTTP requests)
```bash
# Start HTTP API server
node src/agent/http-api-server.js
# Default port: 4001
```

### 3. CLI Wrapper (For command-line agents)
```bash
# Direct CLI usage
node src/agent/cli-wrapper.js benchmark https://example.com
```

---

## 📋 Integration Options

### Option 1: MCP Protocol
**Best for:** Claude Desktop, OpenCode, Gemini CLI (with MCP support)

**Configure in your MCP client:**
```json
{
  "mcpServers": {
    "benchmark-tool": {
      "command": "node",
      "args": ["/home/alex/Dev/benchmark-agentic-tooling/src/agent/generic-mcp-server.js"]
    }
  }
}
```

**Available Tools:**
- `run_benchmark`: Simple URL benchmarking
- `run_flow`: Natural language flow execution  
- `analyze_page`: Quick page analysis

---

### Option 2: HTTP API
**Best for:** OpenCode, Gemini CLI, custom agents, web interfaces

**Start the server:**
```bash
node src/agent/http-api-server.js
# Server runs on http://localhost:4001
```

**API Endpoints:**
```bash
# Run benchmark
curl -X POST http://localhost:4001/benchmark \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'

# Execute flow
curl -X POST http://localhost:4001/flow \
  -H "Content-Type: application/json" \
  -d '{"flow":"Navigate to example.com and click More information"}'

# Analyze page
curl -X POST http://localhost:4001/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","metrics":["lcp","inp","cls"]}'
```

---

### Option 3: CLI Wrapper
**Best for:** Shell scripts, simple automation, testing

**Commands:**
```bash
# Benchmark
node src/agent/cli-wrapper.js benchmark https://example.com

# Flow execution
node src/agent/cli-wrapper.js flow "Navigate and click" https://example.com

# Analysis
node src/agent/cli-wrapper.js analyze https://example.com lcp inp cls
```

---

## 🤖 Agent-Specific Examples

### OpenCode Integration
```javascript
// Using HTTP API
const response = await fetch('http://localhost:4001/benchmark', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com' })
});
const result = await response.json();
console.log(result.report);
```

### Gemini CLI Integration
```bash
# Using CLI wrapper
gemini "Run a performance benchmark on https://example.com using this command: node src/agent/cli-wrapper.js benchmark https://example.com"
```

### Custom Agent Integration
```python
# Using HTTP API
import requests

response = requests.post('http://localhost:4001/flow', json={
    'flow': 'Login with test@test.com and password test123',
    'url': 'https://example.com/login'
})
result = response.json()
print(result['report'])
```

---

## 📊 Response Formats

All interfaces return:
1. **Human-readable report** (ASCII tables)
2. **JSON metrics** (for programmatic use)
3. **Error information** (if applicable)

**Example JSON Response:**
```json
{
  "success": true,
  "metrics": {
    "vitals": { "lcp": 764, "cls": 0, "inp": 0 },
    "cdp": { "tbt": 0, "jsHeap": { "usedMB": "1.13" } }
  },
  "report": "===================================================\n...",
  "timestamp": "2025-12-10T02:54:41.842Z"
}
```

---

## 🔧 Configuration

### Environment Variables
```bash
# HTTP API port
PORT=4001 node src/agent/http-api-server.js

# Playwright options
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_HEADLESS=true
```

### Custom Options
- **Viewport:** Configure browser dimensions
- **Timeout:** Set operation timeouts  
- **Metrics:** Choose specific metrics to collect

---

## 🧪 Testing Your Integration

```bash
# Test MCP server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node src/agent/generic-mcp-server.js

# Test HTTP API
curl http://localhost:4001/health

# Test CLI wrapper
node src/agent/cli-wrapper.js help
```

---

## 📝 Tips for Success

1. **Start with HTTP API** - Easiest to debug and test
2. **Use absolute paths** - Avoid relative path issues
3. **Handle timeouts** - Performance testing can take time
4. **Check JSON responses** - All interfaces return structured data
5. **Monitor console errors** - Important for debugging

Your benchmark tool is now **universally compatible** with any agent that can:
- Use MCP protocol
- Make HTTP requests
- Execute command-line tools

Choose the integration method that best fits your agent's capabilities!