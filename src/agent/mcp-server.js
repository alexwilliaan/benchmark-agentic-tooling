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
                name: 'analyze_site',
                description: 'Analyze a site by opening it, waiting for load, and collecting metrics.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'URL to analyze',
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
                    required: ['url'],
                },
            },
            {
                name: 'run_flow',
                description: 'Execute a guided user flow with specific instructions',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'Starting URL',
                        },
                        instructions: {
                            type: 'array',
                            description: 'List of instructions to execute',
                            items: {
                                type: 'string',
                            },
                        },
                        args: {
                            type: 'object',
                            description: 'Optional arguments/variables for the flow',
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
                    required: ['url', 'instructions'],
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
            case 'analyze_site': {
                const { url, viewport = { width: 1920, height: 1080 } } = args;

                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    throw new Error('URL must include protocol (http:// or https://)');
                }

                const executor = new BenchmarkExecutor();
                // Note: Viewport config needs to be passed to BenchmarkExecutor if supported

                // For analyze_site, we just run the standard benchmark which does Open -> Wait -> Collect
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
                const { url, instructions, args: flowArgs = {}, viewport = { width: 1920, height: 1080 } } = args;

                const executor = new BenchmarkExecutor();
                await executor.initialize();
                await executor.launch(); // We might need to pass viewport here if executor supports it

                // 1. Open the starting URL
                await executor.page.goto(url, { waitUntil: 'domcontentloaded' });

                // 2. Parse instructions
                const executionPlan = parseInstructions(instructions, flowArgs);

                // Validate plan
                const invalidSteps = executionPlan.filter(step => step.action === 'unknown');
                if (invalidSteps.length > 0) {
                    throw new Error(`Invalid instructions detected:\n${invalidSteps.map(s => `  - "${s.original}"`).join('\n')}`);
                }

                console.log('📋 Parsed flow plan:', JSON.stringify(executionPlan, null, 2));

                // 3. Execute flow
                const flowResult = await executeFlow(executor.page, executionPlan);

                // 4. Extract metrics
                const metrics = await executor.extractMetrics();
                await executor.close();

                const report = generateReport(metrics, `Flow on ${url}`);

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

                const resultData = {
                    ...metrics,
                    flow: flowResult
                };

                return {
                    content: [
                        {
                            type: 'text',
                            text: result,
                        },
                        {
                            type: 'text',
                            text: `\n\n**Raw Metrics JSON:**\n\`\`\`json\n${JSON.stringify(resultData, null, 2)}\n\`\`\``,
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
 * Parses list of string instructions into action objects
 * @param {string[]} instructions 
 * @param {object} args 
 */
function parseInstructions(instructions, args) {
    return instructions.map(instruction => {
        const parts = instruction.trim().split(/\s+/);
        const command = parts[0].toLowerCase();

        // Helper to resolve variables like {email}
        const resolveValue = (val) => {
            if (val && val.startsWith('{') && val.endsWith('}')) {
                const key = val.slice(1, -1);
                return args[key] || val;
            }
            return val;
        };

        const remaining = instruction.substring(command.length).trim();

        switch (command) {
            case 'goto':
            case 'navigate':
                return { action: 'navigate', value: parts[1] };

            case 'click':
                return { action: 'click', target: remaining };

            case 'fill':
                // fill <selector> <value>
                // We need to be careful about splitting because selector might have spaces? 
                // Using a simple regex to separate: command selector value
                // Assuming value is the last part
                const fillMatch = remaining.match(/(.+)\s+(.+)$/);
                if (fillMatch) {
                    return {
                        action: 'fill',
                        target: fillMatch[1].trim(),
                        value: resolveValue(fillMatch[2].trim())
                    };
                }
                // If regex fails (no value?), return as is for error later
                return { action: 'fill', target: remaining, value: '' };

            case 'hover':
                return { action: 'hover', target: remaining };

            case 'wait':
                return { action: 'wait', value: parts[1] }; // 'network' or ms

            case 'go_back':
            case 'back':
                return { action: 'back' };

            case 'go_forward':
            case 'forward':
                return { action: 'forward' };

            case 'reload':
            case 'refresh':
                return { action: 'reload' };

            default:
                // Fallback for simple "click this" style if needed, 
                // but we want structured instructions now.
                // We'll treat the whole rest as a target for click if unknown? 
                // Or just error. Let's error/warn.
                return { action: 'unknown', original: instruction };
        }
    });
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