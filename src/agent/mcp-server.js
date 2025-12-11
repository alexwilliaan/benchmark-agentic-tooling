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

                    // Check if we've already waited and should be done
                    const hasWaited = history.some(step => step.action === 'wait');
                    console.log(`🔍 Has waited: ${hasWaited}, History: ${JSON.stringify(history)}`);
                    if (hasWaited) {
                        return { action: 'done', target: '', value: '' };
                    }

                    // Look for navigation instructions - only if we haven't navigated yet
                    if ((lowerInstruction.includes('navigate') || lowerInstruction.includes('go to')) && history.length === 0) {
                        const urlMatch = instruction.match(/https?:\/\/[^\s]+/);
                        if (urlMatch) {
                            return { action: 'navigate', target: '', value: urlMatch[0] };
                        }
                    }

                    // If we've navigated and the instruction mentions waiting, actually wait
                    if (history.length > 0 && (lowerInstruction.includes('wait') || lowerInstruction.includes('load'))) {
                        return { action: 'wait', target: '', value: '' };
                    }

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

                    // Default: if we've done something and no specific action needed, we're done
                    if (history.length > 0) {
                        return { action: 'done', target: '', value: '' };
                    }

                    // Otherwise wait
                    return { action: 'wait', target: '', value: '' };
                };

                const executor = new BenchmarkExecutor();
                await executor.initialize();
                await executor.launch();

                // Don't navigate here - let the flow handle navigation

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
                    result += 'Action history:\n';
                    flowResult.history.forEach((step, i) => {
                        result += `  ${i + 1}. ${step.action} ${step.target || ''} (${step.timestamp}ms)\n`;
                    });
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