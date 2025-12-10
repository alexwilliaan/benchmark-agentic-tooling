import { BenchmarkExecutor } from './executor.js';
import { generateReport } from './reporter.js';
import { executeFlow } from './agent/executor.js';
import { createHttpAgentDecide } from './agent/http-server.js';

/**
 * Entry point for the AI-Driven Web Performance Benchmark Tool
 * 
 * Usage:
 *   Simple benchmark:
 *     pnpm start <url>
 *   
 *   Agent-driven flow:
 *     pnpm start --agent-mode http --agent-url <endpoint> --flow "<description>"
 *     pnpm start --agent-mode mcp --flow "<description>"
 * 
 * Examples:
 *   pnpm start https://example.com
 *   pnpm start --agent-mode http --agent-url http://localhost:4000/decide --flow "Navigate to example.com and click More information"
 */

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArgs(args);

    // Show help if requested
    if (options.help || args.length === 0) {
        showHelp();
        return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 AI-Driven Web Performance Benchmark Tool');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Create executor and run benchmark
    const executor = new BenchmarkExecutor();

    try {
        let metrics;
        let flowResult;

        if (options.agentMode) {
            // Agent-driven flow mode
            console.log('🤖 Mode: Agent-driven flow');
            console.log(`📝 Flow: ${options.flow}`);
            console.log('');

            await executor.initialize();
            await executor.launch();

            // Create agent decide function based on mode
            let agentDecide;
            if (options.agentMode === 'http') {
                if (!options.agentUrl) {
                    throw new Error('--agent-url required for HTTP agent mode');
                }
                console.log(`🌐 Agent endpoint: ${options.agentUrl}`);
                agentDecide = createHttpAgentDecide(options.agentUrl);
            } else if (options.agentMode === 'mcp') {
                throw new Error('MCP mode requires Claude Desktop/Code. See README.md for setup instructions.');
            } else {
                throw new Error(`Unknown agent mode: ${options.agentMode}`);
            }

            // Execute the flow
            flowResult = await executeFlow(executor.page, options.flow, agentDecide);

            // Extract metrics after flow completion
            metrics = await executor.extractMetrics();
            await executor.close();

        } else {
            // Simple benchmark mode
            const url = options.url || 'https://example.com';
            console.log(`🎯 Target: ${url}`);
            console.log('');

            metrics = await executor.runBenchmark(url);
        }

        // Generate and display formatted report
        console.log('');
        const report = generateReport(metrics, options.url || 'Agent-driven flow');
        console.log(report);

        // Show flow summary if agent mode
        if (flowResult) {
            console.log('');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📋 FLOW SUMMARY');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`Steps executed: ${flowResult.steps}`);
            console.log(`Duration: ${(flowResult.duration / 1000).toFixed(2)}s`);
            console.log('');
            console.log('Action history:');
            flowResult.history.forEach((step, i) => {
                console.log(`  ${i + 1}. ${step.action} ${step.target || ''} (${step.timestamp}ms)`);
            });
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }

        console.log('');
        console.log('✅ Benchmark completed successfully');

    } catch (error) {
        console.error('');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ BENCHMARK FAILED');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error(error);
        process.exit(1);
    }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
    const options = {
        url: null,
        agentMode: null,
        agentUrl: null,
        flow: null,
        help: false,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--agent-mode') {
            options.agentMode = args[++i];
        } else if (arg === '--agent-url') {
            options.agentUrl = args[++i];
        } else if (arg === '--flow') {
            options.flow = args[++i];
        } else if (!arg.startsWith('--')) {
            options.url = arg;
        }
    }

    return options;
}

/**
 * Show help message
 */
function showHelp() {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 AI-Driven Web Performance Benchmark Tool');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('USAGE:');
    console.log('  Simple benchmark:');
    console.log('    pnpm start <url>');
    console.log('');
    console.log('  Agent-driven flow:');
    console.log('    pnpm start --agent-mode <http|mcp> --flow "<description>"');
    console.log('');
    console.log('OPTIONS:');
    console.log('  --agent-mode <mode>    Agent integration mode (http or mcp)');
    console.log('  --agent-url <url>      Agent endpoint URL (required for http mode)');
    console.log('  --flow "<description>" Natural language flow description');
    console.log('  --help, -h             Show this help message');
    console.log('');
    console.log('EXAMPLES:');
    console.log('  # Simple benchmark');
    console.log('  pnpm start https://example.com');
    console.log('');
    console.log('  # Agent-driven flow (HTTP)');
    console.log('  pnpm start --agent-mode http --agent-url http://localhost:4000/decide \\');
    console.log('    --flow "Navigate to example.com and click the More information link"');
    console.log('');
    console.log('  # Agent-driven flow (MCP - requires Claude Desktop/Code)');
    console.log('  pnpm start --agent-mode mcp \\');
    console.log('    --flow "Login with test@test.com password test123"');
    console.log('');
    console.log('For detailed setup instructions, see README.md');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
}

main();
