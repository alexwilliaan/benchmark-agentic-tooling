import express from 'express';
import cors from 'cors';
import { BenchmarkExecutor } from '../executor.js';
import { generateReport } from '../reporter.js';
import { executeFlow } from './executor.js';

/**
 * HTTP API Server for Benchmark Agentic Tooling
 * 
 * This provides a REST API that can be used by any agent that can make HTTP requests:
 * - OpenCode
 * - Gemini CLI
 * - Custom agents
 * - Web interfaces
 * 
 * Usage:
 *   node src/agent/http-api-server.js
 * 
 * Default port: 4001
 */

const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// List available endpoints
app.get('/', (req, res) => {
  res.json({
    name: 'Benchmark Agentic Tooling API',
    version: '0.1.0',
    endpoints: {
      'POST /benchmark': 'Run a performance benchmark on a URL',
      'POST /flow': 'Execute a natural language user flow',
      'POST /analyze': 'Analyze a page for performance issues',
      'GET /health': 'Health check endpoint',
    },
    examples: {
      benchmark: {
        url: 'https://example.com',
        viewport: { width: 1920, height: 1080 },
        timeout: 30000
      },
      flow: {
        flow: 'Navigate to example.com and click the More information link',
        url: 'https://example.com',
        maxSteps: 20
      },
      analyze: {
        url: 'https://example.com',
        metrics: ['lcp', 'inp', 'cls', 'tbt']
      }
    }
  });
});

// Run benchmark endpoint
app.post('/benchmark', async (req, res) => {
  try {
    const { url, viewport = { width: 1920, height: 1080 }, timeout = 30000 } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'Missing required parameter: url',
        message: 'URL must include protocol (http:// or https://)'
      });
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ 
        error: 'Invalid URL format',
        message: 'URL must include protocol (http:// or https://)'
      });
    }
    
    const executor = new BenchmarkExecutor();
    const metrics = await executor.runBenchmark(url);
    const report = generateReport(metrics, url);
    
    res.json({
      success: true,
      url,
      metrics,
      report,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Benchmark error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Execute flow endpoint
app.post('/flow', async (req, res) => {
  try {
    const { flow, url, maxSteps = 20, viewport = { width: 1920, height: 1080 } } = req.body;
    
    if (!flow) {
      return res.status(400).json({ 
        error: 'Missing required parameter: flow',
        message: 'Flow description is required'
      });
    }
    
    // Create a simple agent decide function
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
    
    res.json({
      success: true,
      flow,
      flowResult,
      metrics,
      report,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Flow error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Analyze page endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { url, metrics } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'Missing required parameter: url'
      });
    }
    
    const executor = new BenchmarkExecutor();
    await executor.initialize();
    await executor.launch();
    
    await executor.page.goto(url);
    await executor.page.waitForLoadState('networkidle');
    
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
    
    res.json({
      success: true,
      url,
      metrics: filteredMetrics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Benchmark HTTP API Server running on port ${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   POST /benchmark - Run performance benchmark`);
  console.log(`   POST /flow - Execute user flow`);
  console.log(`   POST /analyze - Analyze page performance`);
  console.log(`   GET /health - Health check`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
});