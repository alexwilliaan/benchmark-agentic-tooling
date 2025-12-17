# Agentic Tooling Benchmark Protocol

This document defines the protocol for benchmarking the `benchmark-agentic-tooling` MCP server. It is designed to be read and executed by an AI Agent (e.g., Claude, Gemini) to stress-test the tooling, verify reliability, and identify limits.

## 1. Objective
To systematically evaluate the **reliability**, **performance**, and **correctness** of the `run_flow` and `analyze_site` tools. We aim to answer:
- Does the tool fail gracefully on errors?
- are metrics (LCP, CLS, TBT) consistently captured?
- Can it handle complex, multi-step flows on SPAs (Single Page Applications)?

## 2. Tooling Setup
Ensure the MCP server is running:
- **Command**: `node src/agent/mcp-server.js`
- **Tool Name**: `run_flow`

## 3. Benchmark Scenarios
Run each scenario **10 times** to calculate average duration and success rate.

### Scenario A: Simple Navigation & Analysis
**Goal**: Verify basic page load and metric extraction.
- **URL**: `https://example.com`
- **Instructions**:
  ```json
  ["navigate https://example.com", "wait 2000"]
  ```
- **Success Criteria**:
  - `flow.success` is `true`.
  - `vitals.lcp` > 0.
  - `cdp.resources.count` > 0.

### Scenario B: Form Interaction (Simulated)
**Goal**: Test `fill`, `click`, and selector resolution.
- **URL**: `lojasurf.mercos.com/entrar` (or similar stable public form, strictly for testing selector logic, DO NOT LOG IN)
- **Instructions**:
  ```json
  [
    "navigate https://lojasurf.mercos.com/entrar",
    "wait network",
    "fill #login_field test_user",
    "fill #password test_pass",
    "wait 1000"
  ]
  ```
- **Success Criteria**:
  - `flow.success` is `true`.
  - `flow.history` contains valid `fill` events.
  - No `consoleErrors` in `cdp` metrics (optional, some sites warn).

### Scenario C: Single Page Application (SPA) Transition
**Goal**: Test ability to handle client-side routing without full reloads.
- **URL**: `https://react.dev`
- **Instructions**:
  ```json
  [
    "navigate https://react.dev",
    "wait network",
    "click a[href='/learn']", 
    "wait network",
    "wait 2000"
  ]
  ```
- **Note**: Ensure the "Reference" or "Learn" link is clicked and URL changes.
- **Success Criteria**:
  - `flow.success` is `true`.
  - Final screenshot or URL context should show `/learn`.

### Scenario D: Error Handling (Negative Test)
**Goal**: Verify the tool reports failures correctly (does NOT silently succeed).
- **URL**: `https://example.com`
- **Instructions**:
  ```json
  [
    "navigate https://example.com",
    "click #non-existent-element-12345"
  ]
  ```
- **Success Criteria**:
  - **Tool Execution**: The tool should throw an error OR return `isError: true`.
  - If it returns JSON, `flow.success` should be `false` (if handled gracefully) or the tool call itself should fail.

### Scenario E: Slow SPA E-Commerce (Stress Test)
**Goal**: Test resilience against slow network/rendering and timeouts.
- **URL**: `https://lojasurf.mercos.com/`
- **Instructions**:
  ```json
  [
    "navigate https://lojasurf.mercos.com/",
    "wait network",
    "click .catalog-item-b2b",
    "wait network"
  ]
  ```
- **Note**: Adjust `.product-item` selector to match the specific site.
- **Success Criteria**:
  - `flow.success` is `true`.
  - Tool does NOT timeout.
  - `cdp.jsHeap.usedMB` will likely be high.

### Scenario F: High-Complexity Landing Page
**Goal**: Test performance impact of heavy CSS/JS and animations.
- **URL**: `https://resend.com/`
- **Instructions**:
  ```json
  [
    "navigate https://resend.com/",
    "wait network",
    "scroll to bottom",
    "click a[href='/pricing']",
    "wait network",
    "wait 5000"
  ]
  ```
- **Success Criteria**:
  - `flow.success` is `true`.
  - `vitals.lcp` captured despite heavy load.
  - `vitals.cls` (Cumulative Layout Shift) monitoring.

## 4. Data Collection & Storage
For each run, the executing Agent should store the following data in a `benchmark_results.json` file:

```json
[
  {
    "scenario": "A",
    "run_id": 1,
    "timestamp": "ISO_DATE",
    "vitals": {
      "lcp": 800,
      "cls": 0.01,
      "inp": 50
    },
    "diagnostics": {
      "longTasks": 5,
      "longTasksTotalDuration": 300,
      "scripts": []
    },
    "interactions": [],
    "cdp": {
      "tbt": 50,
      "jsHeap": {
        "usedMB": "150.00",
        "totalMB": "200.00",
        "limitMB": "4096.00"
      },
      "resources": {
        "count": 45,
        "totalSizeMB": "2.50",
        "errors": []
      },
      "consoleErrors": []
    },
    "flow": {
      "success": true,
      "steps": 3,
      "duration": 1250,
      "history": [
        {
          "step": 1,
          "action": "navigate",
          "target": null,
          "value": "https://example.com",
          "timestamp": 500
        }
      ]
    }
  }
]
```

## 5. Analysis
After converting runs:
1.  **Reliability Score**: `(Successful Runs / Total Runs) * 100`
2.  **Performance Baseline**: Average `duration` and `lcp` for Scenario A.
3.  **Error Log**: Aggregate unique error messages from Scenario D.

## 6. Execution Instructions for Agent
1.  **Initialize**: clear previous `benchmark_results.json`.
2.  **Loop**: For each Scenario (A-D):
    -   Loop 5 times.
    -   Call `run_flow` with the specified params.
    -   Parse the "Raw Metrics JSON" from the response.
    -   Append result to `benchmark_results.json`.
3.  **Report**: Generate a summary markdown table of results.
