
import { BenchmarkExecutor } from './src/executor.js';
import { executeFlow } from './src/agent/executor.js';

async function main() {
    console.log('🧪 Starting Benchmark Verification');
    const executor = new BenchmarkExecutor();

    try {
        await executor.initialize();
        await executor.launch();

        // Use a safe, simple URL
        const url = 'https://example.com';
        await executor.page.goto(url, { waitUntil: 'domcontentloaded' });

        const instructions = [
            { action: 'navigate', value: url },
            { action: 'wait', value: '1000' }
        ];

        console.log('Running flow...');
        const flowResult = await executeFlow(executor.page, instructions);

        console.log('Extracting metrics...');
        const metrics = await executor.extractMetrics();

        const resultData = {
            ...metrics,
            flow: flowResult
        };

        console.log('\n✅ Verification Successful!');
        console.log('Result Data Keys:', Object.keys(resultData));

        if (resultData.flow && resultData.vitals && resultData.cdp) {
            console.log('✓ Contains flow, vitals, and cdp sections');
        } else {
            console.error('❌ Missing expected sections');
            process.exit(1);
        }

        console.log('Flow Success:', resultData.flow.success);
        console.log('History Items:', resultData.flow.history.length);

    } catch (err) {
        console.error('❌ Verification Failed:', err);
    } finally {
        await executor.close();
    }
}

main();
