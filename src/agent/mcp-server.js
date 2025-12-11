import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { BenchmarkExecutor } from '../executor.js';
import { generateReport } from '../reporter.js';
import { executeFlow } from './executor.js';

/**
 * Generic MCP Server for Benchmark Agentic Tooling
 * 
 * This server can be used with any MCP-compatible client:
 * - Claude Desktop/Code
 * - OpenCode 
 * - Gemini CLI with MCP support
 * - Custom MCP clients
 * 
 * Usage:
 *   node src/agent/mcp-server.js
 * 
 * Or configure in your MCP client's config file to point to this script.
 */

// Create MCP server
const server = new Server(
    {
        name: 'benchmark-agentic-tooling',
        version: '0.1.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'run_benchmark',
                description: 'Run a performance benchmark on a URL and get detailed metrics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'URL to benchmark (must include protocol, e.g., https://example.com)',
                        },
                        viewport: {
                            type: 'object',
                            description: 'Optional viewport configuration',
                            properties: {
                                width: { type: 'number', default: 1920 },
                                height: { type: 'number', default: 1080 },
                            },
                        },
                        timeout: {
                            type: 'number',
                            description: 'Optional timeout in milliseconds (default: 30000)',
                            default: 30000,
                        },
                    },
                    required: ['url'],
                },
            },
            {
                name: 'run_flow',
                description: 'Execute a natural language user flow and measure performance',
                inputSchema: {
                    type: 'object',
                    properties: {
                        flow: {
                            type: 'string',
                            description: 'Natural language description of the user flow to execute',
                        },
                        url: {
                            type: 'string',
                            description: 'Starting URL (optional, flow can specify navigation)',
                        },
                        maxSteps: {
                            type: 'number',
                            description: 'Maximum number of steps to execute (default: 20)',
                            default: 20,
                        },
                        viewport: {
                            type: 'object',
                            description: 'Optional viewport configuration',
                            properties: {
                                width: { type: 'number', default: 1920 },
                                height: { type: 'number', default: 1080 },
                            },
                        },
                    },
                    required: ['flow'],
                },
            },
            {
                name: 'analyze_page',
                description: 'Analyze a page for performance issues without full benchmark',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'URL to analyze',
                        },
                        metrics: {
                            type: 'array',
                            description: 'Specific metrics to collect (default: all)',
                            items: {
                                type: 'string',
                                enum: ['lcp', 'inp', 'cls', 'tbt', 'js-heap', 'long-tasks', 'network', 'errors'],
                            },
                        },
                    },
                    required: ['url'],
                },
            },
        ],
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'run_benchmark': {
                const { url, viewport = { width: 1920, height: 1080 }, timeout = 30000 } = args;

                // Validate URL
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    throw new Error('URL must include protocol (http:// or https://)');
                }

                const executor = new BenchmarkExecutor();

                // Configure viewport if specified
                if (viewport && (viewport.width !== 1920 || viewport.height !== 1080)) {
                    // Note: You'll need to add viewport configuration to BenchmarkExecutor
                }

                const metrics = await executor.runBenchmark(url);
                const report = generateReport(metrics, url);

                return {
                    content: [
                        {
                            type: 'text',
                            text: report,
                        },
                        {
                            type: 'text',
                            text: `\n\n**Raw Metrics JSON:**\n\`\`\`json\n${JSON.stringify(metrics, null, 2)}\n\`\`\``,
                        },
                    ],
                };
            }

            case 'run_flow': {
                const { flow, url, maxSteps = 20, viewport = { width: 1920, height: 1080 } } = args;

                // Create a generic agent decide function that works with any MCP client
                const agentDecide = async (snapshot, instruction, history) => {
                    // This is where different AI agents would make decisions
                    // For generic MCP, we provide a simple rule-based approach
                    // The actual AI decision making would be handled by the MCP client

                    // Simple heuristic-based decisions for common patterns
                    const lowerInstruction = instruction.toLowerCase();
                    const lowerSnapshot = snapshot.toLowerCase();

                    // Check if we're done
                    if (lowerInstruction.includes('done') || lowerInstruction.includes('complete')) {
                        return { action: 'done', target: '', value: '' };
                    }

                    // Step 1: Navigate (if we haven't navigated yet)
                    const hasNavigated = history.some(step => step.action === 'navigate');
                    if (!hasNavigated) {
                        // Look for navigation instructions
                        if (lowerInstruction.includes('navigate') || lowerInstruction.includes('go to')) {
                            const urlMatch = instruction.match(/https?:\/\/[^\s]+/);
                            if (urlMatch) {
                                return { action: 'navigate', target: '', value: urlMatch[0] };
                            }
                        }
                        // If no URL in instruction, check if url parameter was provided
                        if (url) {
                            return { action: 'navigate', target: '', value: url };
                        }
                    }

                    // Step 2: Wait for page to load (if we've navigated but haven't waited yet)
                    const hasWaited = history.some(step => step.action === 'wait');
                    if (hasNavigated && !hasWaited) {
                        return { action: 'wait', target: '', value: '' };
                    }

                    // Step 3: After navigation and waiting, check for interaction instructions
                    if (hasNavigated && hasWaited) {
                        // Look for fill instructions
                        if (lowerInstruction.includes('fill') || lowerInstruction.includes('enter')) {
                            if (lowerSnapshot.includes('email') || lowerSnapshot.includes('username')) {
                                return { action: 'fill', target: 'email input', value: 'test@example.com' };
                            }
                            if (lowerSnapshot.includes('password')) {
                                return { action: 'fill', target: 'password input', value: 'test123' };
                            }
                        }

                        // Look for click instructions
                        if (lowerInstruction.includes('click') || lowerInstruction.includes('submit') || lowerInstruction.includes('login')) {
                            if (lowerSnapshot.includes('button') || lowerSnapshot.includes('submit')) {
                                return { action: 'click', target: 'submit button', value: '' };
                            }
                        }

                        // If no specific interaction needed, we're done
                        return { action: 'done', target: '', value: '' };
                    }

                    // Default: wait
                    return { action: 'wait', target: '', value: '' };
                };

                const executor = new BenchmarkExecutor();
                await executor.initialize();
                await executor.launch();

                // Don't navigate here - let the flow handle navigation

                // Parse the flow into structured plan
                const plan = parseFlowInstructions(flow);
                console.log('📋 Parsed flow plan:', JSON.stringify(plan, null, 2));

                // Execute the flow
                const flowResult = await executeFlow(executor.page, flow, agentDecide);

                // Extract metrics after flow completion
                const metrics = await executor.extractMetrics();
                await executor.close();

                const report = generateReport(metrics, `Flow: ${flow}`);

                let result = report;

                if (flowResult) {
                    result += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                    result += '📋 FLOW SUMMARY\n';
                    result += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                    result += `Steps executed: ${flowResult.steps}\n`;
                    result += `Duration: ${(flowResult.duration / 1000).toFixed(2)}s\n\n`;

                    // Show parsed plan
                    result += '📝 Parsed Plan:\n';
                    plan.forEach((action, i) => {
                        result += `  ${i + 1}. ${action.type}: ${action.description}\n`;
                    });
                    result += '\n';

                    // Validate execution against plan
                    const validation = validateFlowExecution(plan, flowResult.history);
                    if (!validation.success) {
                        result += '❌ VALIDATION FAILED\n';
                        validation.errors.forEach(err => {
                            result += `  - ${err}\n`;
                        });
                        result += '\n';
                    } else {
                        result += '✅ Validation Passed: All instructions appear to be executed.\n\n';
                    }

                    result += 'Action history:\n';
                    flowResult.history.forEach((step, i) => {
                        result += `  ${i + 1}. ${step.action} ${step.target || ''} (${step.timestamp}ms)\n`;
                    });

                    // If validation failed, mark the tool result as error
                    if (!validation.success) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: result,
                                },
                                {
                                    type: 'text',
                                    text: `\n\n**Raw Metrics JSON:**\n\`\`\`json\n${JSON.stringify(metrics, null, 2)}\n\`\`\``,
                                },
                            ],
                            isError: true,
                        };
                    }
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: result,
                        },
                        {
                            type: 'text',
                            text: `\n\n**Raw Metrics JSON:**\n\`\`\`json\n${JSON.stringify(metrics, null, 2)}\n\`\`\``,
                        },
                    ],
                };
            }

            case 'analyze_page': {
                const { url, metrics } = args;

                const executor = new BenchmarkExecutor();
                await executor.initialize();
                await executor.launch();

                await executor.page.goto(url, { waitUntil: 'domcontentloaded' });

                // Extract specific metrics
                const pageMetrics = await executor.extractMetrics();
                await executor.close();

                // Filter metrics if specified
                let filteredMetrics = pageMetrics;
                if (metrics && metrics.length > 0) {
                    filteredMetrics = {};
                    metrics.forEach(metric => {
                        switch (metric) {
                            case 'lcp':
                                filteredMetrics.lcp = pageMetrics.lcp;
                                break;
                            case 'inp':
                                filteredMetrics.inp = pageMetrics.inp;
                                break;
                            case 'cls':
                                filteredMetrics.cls = pageMetrics.cls;
                                break;
                            case 'tbt':
                                filteredMetrics.tbt = pageMetrics.tbt;
                                break;
                            case 'js-heap':
                                filteredMetrics.jsHeap = pageMetrics.jsHeap;
                                break;
                            case 'long-tasks':
                                filteredMetrics.longTasks = pageMetrics.longTasks;
                                break;
                            case 'network':
                                filteredMetrics.requests = pageMetrics.requests;
                                break;
                            case 'errors':
                                filteredMetrics.errors = pageMetrics.errors;
                                break;
                        }
                    });
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: `**Page Analysis for ${url}**\n\n\`\`\`json\n${JSON.stringify(filteredMetrics, null, 2)}\n\`\`\``,
                        },
                    ],
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `❌ Error: ${error.message}\n\nStack trace:\n\`\`\`\n${error.stack}\n\`\`\``,
                },
            ],
            isError: true,
        };
    }
});

/**
 * Parse natural language flow into structured action plan
 * @param {string} flowInstruction - Natural language flow description
 * @returns {Array} Array of action objects { type, target, value }
 */
function parseFlowInstructions(flowInstruction) {
    const plan = [];
    const text = flowInstruction.toLowerCase();

    // Split by common separators (then, and then, next, after that, etc.)
    const steps = flowInstruction.split(/\s+(?:then|and then|next|after that|,)\s+/i);

    for (const step of steps) {
        const trimmed = step.trim();
        if (!trimmed) continue;

        // Navigate/Go to patterns
        const navMatch = trimmed.match(/(?:navigate|go)\s+to\s+([^\s,]+)/i);
        if (navMatch) {
            // Allow bare domains by prefixing https:// when scheme is missing
            const target = navMatch[1].match(/^https?:\/\//i) ? navMatch[1] : `https://${navMatch[1]}`;
            plan.push({
                type: 'navigate',
                target,
                description: trimmed
            });
            continue;
        }

        // Back/return navigation
        if (trimmed.match(/back\s+to\s+(?:home|homepage|previous\s+page)/i) || trimmed.match(/\bgo\s+back\b/i)) {
            plan.push({
                type: 'back',
                description: trimmed
            });
            continue;
        }

        // Click patterns
        const clickMatch = trimmed.match(/click\s+(?:on\s+)?(?:the\s+)?(.+)/i);
        if (clickMatch) {
            plan.push({
                type: 'click',
                target: clickMatch[1].trim(),
                description: trimmed
            });
            continue;
        }

        // Common “first product” phrasing when missing explicit click verb
        if (trimmed.match(/first\s+product/i)) {
            plan.push({
                type: 'click',
                target: 'first product',
                description: trimmed
            });
            continue;
        }

        // Fill/Enter patterns
        const fillMatch = trimmed.match(/(?:fill|enter)\s+(.+?)\s+(?:with|in)\s+(.+)/i);
        if (fillMatch) {
            plan.push({
                type: 'fill',
                target: fillMatch[1].trim(),
                value: fillMatch[2].trim(),
                description: trimmed
            });
            continue;
        }

        // Wait patterns
        if (trimmed.match(/wait/i)) {
            plan.push({
                type: 'wait',
                description: trimmed
            });
            continue;
        }

        // If we can't parse it, add as unknown for debugging
        console.warn(`Could not parse step: "${trimmed}"`);
        plan.push({
            type: 'unknown',
            description: trimmed
        });
    }

    return plan;
}

/**
 * Validates if the executed flow matches the planned actions
 * @param {Array} plan - Structured action plan from parseFlowInstructions
 * @param {Array} history - Execution history from executeFlow
 */
function validateFlowExecution(plan, history) {
    const errors = [];

    // For each planned action, check if it was executed
    for (const plannedAction of plan) {
        // Unknown steps should surface as failures
        if (plannedAction.type === 'unknown') {
            errors.push(`Unrecognized instruction: ${plannedAction.description}`);
            continue;
        }

        // Find matching action in history
        const found = history.some(executed => {
            if (executed.action !== plannedAction.type) {
                return false;
            }

            // For navigate actions, compare URLs
            if (plannedAction.type === 'navigate') {
                const normalize = u => u.toLowerCase().replace(/\/$/, '');
                return normalize(executed.value || executed.url || '').includes(normalize(plannedAction.target));
            }

            if (plannedAction.type === 'back') {
                return executed.action === 'back';
            }

            // For click/fill actions, compare targets (fuzzy match)
            if (plannedAction.type === 'click' || plannedAction.type === 'fill') {
                const normalizeTarget = t => t.toLowerCase().replace(/[^a-z0-9]/g, '');
                return normalizeTarget(executed.target || '').includes(normalizeTarget(plannedAction.target));
            }

            // For wait, just check the action type matches
            if (plannedAction.type === 'wait') {
                return true;
            }

            return false;
        });

        if (!found) {
            errors.push(`Expected action not performed: ${plannedAction.description}`);
        }
    }

    return {
        success: errors.length === 0,
        errors
    };
}


// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🚀 Generic Benchmark MCP Server running on stdio');
    console.error('📊 Available tools: run_benchmark, run_flow, analyze_page');
}

main().catch((error) => {
    console.error('❌ Server error:', error);
    process.exit(1);
});