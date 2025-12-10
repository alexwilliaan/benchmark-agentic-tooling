/**
 * HTTP API Server for Generic Agent Integration
 * 
 * Provides a simple HTTP endpoint for AI agents to interact with the benchmark tool.
 * Agents send requests with DOM snapshots and receive action decisions.
 */

import express from 'express';
import cors from 'cors';

/**
 * Create and start HTTP API server
 * @param {number} port - Port to listen on
 * @returns {Promise<object>} Server instance and control functions
 */
export async function createAgentServer(port = 3000) {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Store for pending requests (agent will respond to these)
    const pendingRequests = new Map();
    let requestIdCounter = 0;

    /**
     * POST /agent/decide-action
     * 
     * Request body:
     * {
     *   snapshot: string,      // Current DOM snapshot
     *   instruction: string,   // Original flow description
     *   history: array         // Previous actions taken
     * }
     * 
     * Response:
     * {
     *   action: string,        // navigate, click, fill, wait, done
     *   target: string,        // Element description (for click/fill)
     *   value: string          // Value (for fill/navigate)
     * }
     */
    app.post('/agent/decide-action', async (req, res) => {
        const { snapshot, instruction, history } = req.body;

        if (!snapshot || !instruction) {
            return res.status(400).json({
                error: 'Missing required fields: snapshot and instruction'
            });
        }

        // For now, this endpoint expects the agent to be the one making the request
        // The agent analyzes the snapshot and returns a decision
        // This is a placeholder - actual implementation depends on how the agent connects

        res.status(501).json({
            error: 'This endpoint is for documentation. Use the agentDecide function instead.',
            usage: 'The benchmark tool calls your agent function, not the other way around.'
        });
    });

    /**
     * GET /health
     * Health check endpoint
     */
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', message: 'Agent API server is running' });
    });

    /**
     * GET /
     * API documentation
     */
    app.get('/', (req, res) => {
        res.json({
            name: 'AI-Driven Web Performance Benchmark Tool - Agent API',
            version: '1.0.0',
            endpoints: {
                'GET /': 'API documentation',
                'GET /health': 'Health check',
                'POST /agent/decide-action': 'Agent decision endpoint (see docs)'
            },
            usage: 'This API is designed to work with AI agents that can analyze DOM snapshots and return navigation actions.'
        });
    });

    // Start server
    const server = await new Promise((resolve, reject) => {
        const s = app.listen(port, () => {
            console.log(`🌐 Agent API server listening on http://localhost:${port}`);
            resolve(s);
        });
        s.on('error', reject);
    });

    return {
        server,
        port,
        close: () => {
            return new Promise((resolve) => {
                server.close(resolve);
            });
        }
    };
}

/**
 * Create an agent decide function that calls an external HTTP endpoint
 * @param {string} endpoint - Full URL to agent endpoint
 * @returns {Function} Agent decide function
 */
export function createHttpAgentDecide(endpoint) {
    return async (snapshot, instruction, history) => {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                snapshot,
                instruction,
                history,
            }),
        });

        if (!response.ok) {
            throw new Error(`Agent endpoint returned ${response.status}: ${await response.text()}`);
        }

        const decision = await response.json();

        // Validate decision format
        if (!decision.action) {
            throw new Error('Agent response missing required field: action');
        }

        return decision;
    };
}
