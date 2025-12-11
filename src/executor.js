import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * BenchmarkExecutor - Playwright controller for performance benchmarking
 * 
 * Responsibilities:
 * - Launch Chromium browser
 * - Inject observer.js before page navigation
 * - Execute navigation and interactions
 * - Extract performance metrics from window.__BENCHMARK_METRICS__
 */
export class BenchmarkExecutor {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.observerScript = null;
        this.cdpSession = null;

        // CDP-collected metrics
        this.cdpMetrics = {
            tbt: 0,
            jsHeap: { used: 0, total: 0, limit: 0 },
            resources: { count: 0, totalSize: 0, errors: [] },
            consoleErrors: [],
        };

        // Network tracking
        this.networkRequests = [];
        this.longTasks = [];
    }

    /**
     * Initialize the executor and load the observer script
     */
    async initialize() {
        // Load the observer.js script content
        const observerPath = join(__dirname, 'observer.js');
        this.observerScript = readFileSync(observerPath, 'utf-8');

        console.log('✓ Observer script loaded');
    }

    /**
     * Launch the browser and create a new page
     */
    async launch() {
        this.browser = await chromium.launch({
            headless: false, // Set to true for production, false for debugging
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
        });

        this.page = await this.context.newPage();

        // Inject the observer script BEFORE any navigation
        // This ensures it runs on every page load
        await this.page.addInitScript(this.observerScript);

        // Setup CDP session for advanced metrics
        await this.setupCDP();

        // Setup network monitoring
        this.setupNetworkMonitoring();

        // Setup console monitoring
        this.setupConsoleMonitoring();

        console.log('✓ Browser launched (Chromium)');
        console.log('✓ Observer injected via addInitScript');
        console.log('✓ CDP session established');
    }

    /**
     * Navigate to a URL and wait for the page to load
     * @param {string} url - The URL to navigate to
     */
    async navigate(url) {
        console.log(`→ Navigating to: ${url}`);
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });

        console.log('✓ Page loaded');
    }



    /**
     * Setup CDP session for advanced metrics collection
     */
    async setupCDP() {
        // Get CDP session from the page
        this.cdpSession = await this.page.context().newCDPSession(this.page);

        // Enable Performance domain to track timeline events
        await this.cdpSession.send('Performance.enable');
    }

    /**
     * Setup network request monitoring
     */
    setupNetworkMonitoring() {
        this.page.on('request', (request) => {
            this.networkRequests.push({
                url: request.url(),
                method: request.method(),
                resourceType: request.resourceType(),
            });
        });

        this.page.on('requestfailed', (request) => {
            this.cdpMetrics.resources.errors.push({
                url: request.url(),
                failure: request.failure()?.errorText || 'Unknown error',
            });
        });

        this.page.on('response', (response) => {
            const headers = response.headers();
            const contentLength = parseInt(headers['content-length'] || '0', 10);
            this.cdpMetrics.resources.totalSize += contentLength;
        });
    }

    /**
     * Setup console error monitoring
     */
    setupConsoleMonitoring() {
        this.page.on('console', (msg) => {
            if (msg.type() === 'error') {
                this.cdpMetrics.consoleErrors.push({
                    text: msg.text(),
                    location: msg.location(),
                });
            }
        });
    }

    /**
     * Collect CDP-specific metrics (TBT, JS Heap)
     */
    async collectCDPMetrics() {
        // Collect JS Heap usage
        const heapUsage = await this.page.evaluate(() => {
            if (performance.memory) {
                return {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit,
                };
            }
            return null;
        });

        if (heapUsage) {
            this.cdpMetrics.jsHeap = heapUsage;
        }

        // Calculate TBT from Performance Timeline
        // TBT = sum of blocking time for all long tasks (> 50ms)
        // Blocking time = task duration - 50ms
        const performanceMetrics = await this.page.evaluate(() => {
            const entries = performance.getEntriesByType('measure');
            const navigation = performance.getEntriesByType('navigation')[0];

            return {
                navigation: navigation ? {
                    domContentLoaded: navigation.domContentLoadedEventEnd,
                    loadComplete: navigation.loadEventEnd,
                } : null,
            };
        });

        // Get long tasks from our observer data and calculate TBT
        const observerMetrics = await this.page.evaluate(() => {
            return window.__BENCHMARK_METRICS__;
        });

        if (observerMetrics?.diagnostics?.longTasksTotalDuration) {
            // Approximate TBT: for each long task, the blocking portion is duration - 50ms
            // We use the total duration and subtract 50ms per task
            const taskCount = observerMetrics.diagnostics.longTasks;
            const totalDuration = observerMetrics.diagnostics.longTasksTotalDuration;
            this.cdpMetrics.tbt = Math.max(0, totalDuration - (taskCount * 50));
        }

        // Set resource count
        this.cdpMetrics.resources.count = this.networkRequests.length;
    }

    /**
     * Extract the collected metrics from the page
     * @returns {Object} The combined metrics object
     */
    async extractMetrics() {
        // Get Performance Observer metrics with timeout
        let observerMetrics;
        try {
            observerMetrics = await Promise.race([
                this.page.evaluate(() => {
                    return window.__BENCHMARK_METRICS__;
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Metrics extraction timeout')), 5000)
                )
            ]);
        } catch (error) {
            console.warn('Failed to extract observer metrics:', error.message);
            observerMetrics = {
                vitals: { lcp: 0, cls: 0, inp: 0 },
                diagnostics: { longTasks: 0, longTasksTotalDuration: 0, scripts: [] },
                interactions: []
            };
        }

        // Collect CDP metrics with timeout
        try {
            await Promise.race([
                this.collectCDPMetrics(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('CDP metrics collection timeout')), 5000)
                )
            ]);
        } catch (error) {
            console.warn('Failed to collect CDP metrics:', error.message);
        }

        // Ensure observerMetrics has the required structure
        const safeObserverMetrics = observerMetrics || {
            vitals: { lcp: 0, cls: 0, inp: 0 },
            diagnostics: { longTasks: 0, longTasksTotalDuration: 0, scripts: [] },
            interactions: []
        };

        // Combine all metrics
        const combinedMetrics = {
            vitals: safeObserverMetrics.vitals || { lcp: 0, cls: 0, inp: 0 },
            diagnostics: safeObserverMetrics.diagnostics || { longTasks: 0, longTasksTotalDuration: 0, scripts: [] },
            interactions: safeObserverMetrics.interactions || [],
            cdp: {
                tbt: this.cdpMetrics.tbt,
                jsHeap: {
                    usedMB: (this.cdpMetrics.jsHeap.used / 1024 / 1024).toFixed(2),
                    totalMB: (this.cdpMetrics.jsHeap.total / 1024 / 1024).toFixed(2),
                    limitMB: (this.cdpMetrics.jsHeap.limit / 1024 / 1024).toFixed(2),
                },
                resources: {
                    count: this.cdpMetrics.resources.count,
                    totalSizeMB: (this.cdpMetrics.resources.totalSize / 1024 / 1024).toFixed(2),
                    errors: this.cdpMetrics.resources.errors,
                },
                consoleErrors: this.cdpMetrics.consoleErrors,
            },
        };

        console.log('✓ Metrics extracted (Observer + CDP)');
        return combinedMetrics;
    }

    /**
     * Close the browser and clean up
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('✓ Browser closed');
        }
    }

    /**
     * Run a complete benchmark for a given URL
     * @param {string} url - The URL to benchmark
     * @returns {Object} The collected performance metrics
     */
    async runBenchmark(url) {
        try {
            await this.initialize();
            await this.launch();
            await this.navigate(url);
            const metrics = await this.extractMetrics();
            await this.close();

            return metrics;
        } catch (error) {
            console.error('Error during benchmark execution:', error);
            await this.close();
            throw error;
        }
    }
}
