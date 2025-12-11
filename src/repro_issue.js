
import { executeFlow } from './agent/executor.js';
import { BenchmarkExecutor } from './executor.js';

// Copy of the agentDecide function from mcp-server.js
const agentDecide = async (snapshot, instruction, history) => {
    const lowerInstruction = instruction.toLowerCase();
    const lowerSnapshot = snapshot.toLowerCase();

    // Check if we're done
    if (lowerInstruction.includes('done') || lowerInstruction.includes('complete')) {
        return { action: 'done', target: '', value: '' };
    }

    // Step 1: Navigate (if we haven't navigated yet)
    const hasNavigated = history.some(step => step.action === 'navigate');
    if (!hasNavigated) {
        if (lowerInstruction.includes('navigate') || lowerInstruction.includes('go to')) {
            const urlMatch = instruction.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
                return { action: 'navigate', target: '', value: urlMatch[0] };
            }
        }
    }

    // Step 2: Wait for page to load (if we've navigated but haven't waited yet)
    const hasWaited = history.some(step => step.action === 'wait');
    if (hasNavigated && !hasWaited) {
        return { action: 'wait', target: '', value: '' };
    }

    // Step 3: After navigation and waiting, check for interaction instructions
    if (hasNavigated && hasWaited) {
        // ... (interactions omitted for brevity, they don't matter for this repro)

        // If no specific interaction needed, we're done
        return { action: 'done', target: '', value: '' };
    }

    // Default: wait
    return { action: 'wait', target: '', value: '' };
};

async function run() {
    console.log('--- Reproduction Script ---');
    const executor = new BenchmarkExecutor();
    await executor.initialize();
    await executor.launch(); // Launches browser

    const flow = "navigate to https://example.com then navigate to https://google.com";
    console.log(`Flow: "${flow}"`);

    try {
        const result = await executeFlow(executor.page, flow, agentDecide);
        console.log('Result:', result);

        // Check if we actually visited both
        const navigations = result.history.filter(h => h.action === 'navigate');
        console.log('Navigations performed:', navigations.map(n => n.value));

        if (navigations.length < 2) {
            console.log('FAIL: Did not perform all navigations, but reported success!');
        } else {
            console.log('SUCCESS: Performed all navigations.');
        }

    } catch (e) {
        console.error('Error executing flow:', e);
    } finally {
        await executor.close();
    }
}

run();
