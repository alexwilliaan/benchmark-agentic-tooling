Here is the updated, comprehensive plan for the **AI-Driven Web Performance Benchmark Tool**.

***

# Project Plan: AI-Driven Web Performance Benchmark Tool

## 1. Project Overview
A tool designed to bridge the gap between automated testing and performance engineering. It uses **Playwright** to execute user journeys, injects browser-native **Performance Observers** to capture accurate metrics, and utilizes an **AI Agent** to interpret data, identify bottlenecks, and suggest fixes.

## 2. Technical Stack
*   **Core Automation:** Playwright (Node.js).
*   **Browser:** Chromium (default), configurable to WebKit/Firefox.
*   **Performance API:** Native `PerformanceObserver` (injected JS) & Chrome DevTools Protocol (CDP).
*   **AI Layer:** Agent responsible for semantic navigation and result analysis.

## 3. Metric Strategy

We define "Performance" through three distinct lenses:

### A. Core Web Vitals (The UX Standard)
| Metric | Description | Target | Captured By |
| :--- | :--- | :--- | :--- |
| **LCP** | Largest Contentful Paint (Load Speed) | < 2.5s | `observer.js` (Injected) |
| **INP** | Interaction to Next Paint (Responsiveness) | < 200ms | `observer.js` (Injected) |
| **CLS** | Cumulative Layout Shift (Visual Stability) | < 0.1 | `observer.js` (Injected) |

### B. System Diagnostics (The "Engine Room")
| Metric | Description | Captured By |
| :--- | :--- | :--- |
| **TBT** | Total Blocking Time (Main Thread Jams) | Chrome DevTools Protocol (CDP) |
| **JS Heap** | Memory usage (potential leaks) | `performance.memory` API |
| **Resources** | Network payloads, 404s, slow APIs | Playwright Network Events |

### C. User Journey Metrics (Business Value)
| Metric | Description | Captured By |
| :--- | :--- | :--- |
| **Flow Time** | Total time to complete the task | Playwright Execution Timer |
| **Success/Fail** | Did the user complete the goal? | Agent Validation |

## 4. Architecture Design

### Component 1: The Observer (`observer.js`)
A lightweight JavaScript module injected by Playwright at the start of every session (`page.addInitScript`).
*   **Responsibility:** Silently listens to browser performance entries.
*   **Data Storage:** Accumulates data in a global window object (e.g., `window.__BENCHMARK_METRICS__`).

### Component 2: The Executor (Playwright Engine)
The main controller script.
1.  **Setup:** Launches browser, establishes CDP session.
2.  **Injection:** Injects `observer.js`.
3.  **Action:** Executes the AI-driven steps (click, type, scroll).
4.  **Extraction:** Retrieves the global metrics object and CDP traces.

### Component 3: The Semantic Navigator (AI Agent)
Instead of brittle CSS selectors, the Agent receives a simplified snapshot of the DOM.
*   **Input:** `[Button: "Add to Cart"]`, `[Input: "Email"]`
*   **Action:** Decides which element to interact with based on the user's natural language goal.

## 5. Reporting Structure

The output will be generated in a "Soft Table" format for terminal compatibility, followed by a deep-dive analysis.

### A. The Dashboard (ASCII Table)
```text
===============================================================
 BENCHMARK REPORT: User Flow "Add to Cart"
 Browser: Chromium 121 | Window: 1920x1080 | Throttling: None
===============================================================

 CORE VITALS (UX)
 ---------------------------------------------------------------
 Metric    | Value       | Target      | Status
 ---------------------------------------------------------------
 LCP       | 1,240 ms    | < 2,500 ms  | ✅ PASS
 INP       | 350 ms      | < 200 ms    | ❌ POOR
 CLS       | 0.05        | < 0.1       | ✅ PASS
 FCP       | 800 ms      | < 1,800 ms  | ✅ PASS

 SYSTEM & RESOURCES
 ---------------------------------------------------------------
 Metric    | Value       | Context     | Status
 ---------------------------------------------------------------
 JS Heap   | 45.2 MB     | Used        | ⚠️ HIGH
 DOM Nodes | 1,402       | Total       | ✅ PASS
 Requests  | 24          | Network     | -- OK
 Errors    | 0           | Console     | ✅ PASS
 TBT       | [N/A]       | Blocking    | ❓ FAILED TO CAPTURE

 TIMING
 ---------------------------------------------------------------
 Flow Time | 4.82s       | Total Run   | --
 Interacts | 1.2s        | Processing  | --
===============================================================
```

### B. Bottleneck Analysis (Correlation Logic)
The tool analyzes the timeline to find the root cause of failures.

> **🚩 CRITICAL BOTTLENECK DETECTED: High Interaction Latency (INP)**
> *   **Event:** Click on "Add to Cart" at `00:04:12`.
> *   **Impact:** UI froze for **350ms**.
> *   **Root Cause:** Long Task (310ms) triggered by `third-party-analytics.js`.

### C. Agent Handoff
> **🤖 AGENT INTELLIGENCE:**
> I have identified the issue. Would you like me to:
> 1. Analyze the script call stack?
> 2. Suggest a code patch?
> 3. Re-run with network throttling?

## 6. Implementation Stages
1.  **Stage 1:** Create `observer.js` to capture Core Web Vitals.
2.  **Stage 2:** Build the Playwright scaffold to inject the observer and run a dummy flow.
3.  **Stage 3:** Integrate CDP to capture TBT (Total Blocking Time).
4.  **Stage 4:** Build the Report Generator (ASCII table logic).
5.  **Stage 5:** Connect the AI Agent for semantic navigation and analysis.