
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, 'agent', 'mcp-server.js');

console.log(`Starting server at ${serverPath}`);

const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'inherit'] // pipe stdin/stdout, inherit stderr
});

const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
        name: "run_flow",
        arguments: {
            flow: "navigate to https://example.com then navigate to https://google.com" // This is known to fail execution
        }
    }
};

let outputBuffer = '';

server.stdout.on('data', (data) => {
    const chunk = data.toString();
    outputBuffer += chunk;
    console.log(`[Server Output] ${chunk}`);

    try {
        // Attempt to parse JSON-RPC messages (might be multiple or partial)
        const lines = outputBuffer.split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const response = JSON.parse(line);
                if (response.id === 1) {
                    handleResponse(response);
                    server.kill();
                    process.exit(0);
                }
            } catch (e) {
                // Not a complete JSON line yet, or not JSON
            }
        }
    } catch (e) {
        console.error('Error parsing output:', e);
    }
});

function handleResponse(response) {
    console.log('\n--- Test Result ---');
    if (response.error) {
        console.error('RPC Error:', response.error);
        return;
    }

    const content = response.result.content[0].text;
    const isError = response.result.isError;

    console.log(`isError: ${isError}`);

    if (content.includes('❌ VALIDATION FAILED')) {
        console.log('SUCCESS: Validation failure detected as expected.');
        console.log(content.split('❌ VALIDATION FAILED')[1].split('\n\n')[0]);
    } else {
        console.log('FAIL: Validation failure NOT detected.');
    }
}

// Send request
console.log('Sending request...');
server.stdin.write(JSON.stringify(request) + '\n');
