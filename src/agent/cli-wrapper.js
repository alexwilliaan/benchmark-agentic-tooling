#!/usr/bin/env node

import { BenchmarkExecutor } from '../executor.js';
import { generateReport } from '../reporter.js';
import { executeFlow } from './executor.js';

/**
 * CLI Wrapper for Benchmark Agentic Tooling
 * 
 * This provides a command-line interface that can be used by any agent:
 * - OpenCode
 * - Gemini CLI
 * - Custom scripts
 * - Shell commands
 * 
 * Usage:
 *   node src/agent/cli-wrapper.js benchmark <url>
 *   node src/agent/cli-wrapper.js flow "<description>" [url]
 *   node src/agent/cli-wrapper.js analyze <url> [metrics]
 */

const args = process.argv.slice(2);
const command = args[0];

async function runBenchmark(url) {
  const executor = new BenchmarkExecutor();
  const metrics = await executor.runBenchmark(url);
  const report = generateReport(metrics, url);
  
  // Output both human-readable and JSON formats
  console.log('=== BENCHMARK REPORT ===');
  console.log(report);
  console.log('\n=== METRICS JSON ===');
  console.log(JSON.stringify(metrics, null, 2));
  
  return metrics;
}

async function runFlow(flow, url = null) {
  const agentDecide = async (snapshot, instruction, history) => {
    // Simple heuristic-based decisions
    const lowerInstruction = instruction.toLowerCase();
    const lowerSnapshot = snapshot.toLowerCase();
    
    if (lowerInstruction.includes('done') || lowerInstruction.includes('complete')) {
      return { action: 'done', target: '', value: '' };
    }
    
    if (lowerInstruction.includes('navigate') || lowerInstruction.includes('go to')) {
      const urlMatch = instruction.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        return { action: 'navigate', target: '', value: urlMatch[0] };
      }
    }
    
    if (lowerInstruction.includes('fill') || lowerInstruction.includes('enter')) {
      if (lowerSnapshot.includes('email') || lowerSnapshot.includes('username')) {
        return { action: 'fill', target: 'email input', value: 'test@example.com' };
      }
      if (lowerSnapshot.includes('password')) {
        return { action: 'fill', target: 'password input', value: 'test123' };
      }
    }
    
    if (lowerInstruction.includes('click') || lowerInstruction.includes('submit') || lowerInstruction.includes('login')) {
      if (lowerSnapshot.includes('button') || lowerSnapshot.includes('submit')) {
        return { action: 'click', target: 'submit button', value: '' };
      }
    }
    
    return { action: 'wait', target: '', value: '' };
  };
  
  const executor = new BenchmarkExecutor();
  await executor.initialize();
  await executor.launch();
  
  if (url) {
    await executor.page.goto(url);
    await executor.page.waitForLoadState('networkidle');
  }
  
  const flowResult = await executeFlow(executor.page, flow, agentDecide);
  const metrics = await executor.extractMetrics();
  await executor.close();
  
  const report = generateReport(metrics, `Flow: ${flow}`);
  
  console.log('=== FLOW EXECUTION REPORT ===');
  console.log(report);
  
  if (flowResult) {
    console.log('\n=== FLOW SUMMARY ===');
    console.log(`Steps executed: ${flowResult.steps}`);
    console.log(`Duration: ${(flowResult.duration / 1000).toFixed(2)}s`);
    console.log('Action history:');
    flowResult.history.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.action} ${step.target || ''} (${step.timestamp}ms)`);
    });
  }
  
  console.log('\n=== METRICS JSON ===');
  console.log(JSON.stringify({ flowResult, metrics }, null, 2));
  
  return { flowResult, metrics };
}

async function analyzePage(url, metricsList = null) {
  const executor = new BenchmarkExecutor();
  await executor.initialize();
  await executor.launch();
  
  await executor.page.goto(url);
  await executor.page.waitForLoadState('networkidle');
  
  const pageMetrics = await executor.extractMetrics();
  await executor.close();
  
  // Filter metrics if specified
  let filteredMetrics = pageMetrics;
  if (metricsList && metricsList.length > 0) {
    filteredMetrics = {};
    metricsList.forEach(metric => {
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
  
  console.log(`=== PAGE ANALYSIS: ${url} ===`);
  console.log(JSON.stringify(filteredMetrics, null, 2));
  
  return filteredMetrics;
}

function showHelp() {
  console.log(`
Benchmark Agentic Tooling CLI Wrapper

USAGE:
  node src/agent/cli-wrapper.js <command> [arguments]

COMMANDS:
  benchmark <url>                    Run performance benchmark on URL
  flow "<description>" [url]         Execute natural language flow
  analyze <url> [metrics]            Analyze page performance

EXAMPLES:
  # Simple benchmark
  node src/agent/cli-wrapper.js benchmark https://example.com

  # Flow execution
  node src/agent/cli-wrapper.js flow "Navigate to example.com and click More information"

  # Flow with starting URL
  node src/agent/cli-wrapper.js flow "Login with test@test.com" https://example.com/login

  # Analyze specific metrics
  node src/agent/cli-wrapper.js analyze https://example.com lcp inp cls

OUTPUT:
  - Human-readable report
  - JSON metrics for programmatic use
  - Exit code 0 on success, 1 on error
`);
}

async function main() {
  try {
    switch (command) {
      case 'benchmark':
        if (args.length < 2) {
          console.error('Error: URL required for benchmark command');
          showHelp();
          process.exit(1);
        }
        await runBenchmark(args[1]);
        break;
        
      case 'flow':
        if (args.length < 2) {
          console.error('Error: Flow description required for flow command');
          showHelp();
          process.exit(1);
        }
        await runFlow(args[1], args[2]);
        break;
        
      case 'analyze':
        if (args.length < 2) {
          console.error('Error: URL required for analyze command');
          showHelp();
          process.exit(1);
        }
        const metrics = args.slice(2);
        await analyzePage(args[1], metrics.length > 0 ? metrics : null);
        break;
        
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
        
      default:
        console.error(`Error: Unknown command '${command}'`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
}

main();