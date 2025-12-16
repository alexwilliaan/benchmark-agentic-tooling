/**
 * Flow Executor
 * 
 * Executes AI-driven user flows by coordinating between the agent,
 * DOM snapshots, and Playwright actions.
 */

import { generateSnapshot, getPageContext } from './snapshot.js';
import { locateElement, executeAction } from './locator.js';

/**
 * Execute a deterministic user flow
 * @param {Page} page - Playwright page object
 * @param {Array} executionPlan - List of action objects
 * @returns {Promise<object>} Execution result with history
 */
export async function executeFlow(page, executionPlan) {
    const history = [];
    const startTime = Date.now();
    let stepCount = 0;

    console.log('🤖 Starting explicit flow execution');
    console.log(`📝 Plan: ${executionPlan.length} steps`);
    console.log('');

    try {
        for (const step of executionPlan) {
            stepCount++;
            console.log(`\n━━━ Step ${stepCount}: ${step.action} ━━━`);

            // Execute the action
            await executeStep(page, step);

            // Record in history
            history.push({
                step: stepCount,
                action: step.action,
                target: step.target,
                value: step.action === 'fill' ? '***' : step.value,
                timestamp: Date.now() - startTime,
            });

            console.log('✓ Step completed');
        }

        const duration = Date.now() - startTime;
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Flow completed in ${stepCount} steps (${(duration / 1000).toFixed(2)}s)`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return {
            success: true,
            steps: stepCount,
            duration,
            history,
        };

    } catch (error) {
        // Detailed error reporting
        const context = await getPageContext(page);

        console.error('');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ FLOW EXECUTION FAILED');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('');
        console.error(`Error at step ${stepCount}:`);
        console.error(error.message);
        console.error('');
        console.error(`Current URL: ${context.url}`);
        console.error(`Page Title: ${context.title}`);
        console.error('');
        console.error('Action history:');
        history.forEach((h, i) => {
            console.error(`  ${i + 1}. ${h.action} ${h.target || ''} (${h.timestamp}ms)`);
        });
        console.error('');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        throw error;
    }
}



/**
 * Wait for network activity to settle before proceeding
 */
async function waitForNetworkSettlement(page) {
    let lastActivity = Date.now();
    let requestCount = 0;

    const requestHandler = () => {
        requestCount++;
        lastActivity = Date.now();
    };

    const responseHandler = () => {
        lastActivity = Date.now();
    };

    // Monitor network activity
    page.on('request', requestHandler);
    page.on('response', responseHandler);

    // Wait for 2 seconds of no network activity, max 15 seconds total
    const startTime = Date.now();
    while (Date.now() - lastActivity < 2000 && Date.now() - startTime < 15000) {
        await page.waitForTimeout(100);
    }

    // Clean up listeners
    page.off('request', requestHandler);
    page.off('response', responseHandler);

    console.log(`✓ Network settled after ${requestCount} requests`);
}

/**
 * Execute a single step
 * @param {Page} page - Playwright page object
 * @param {object} decision - Agent decision {action, target, value}
 */
async function executeStep(page, decision) {
    const { action, target, value } = decision;

    switch (action) {
        case 'navigate':
            if (!value) {
                throw new Error('Navigate action requires a URL value');
            }
            await page.goto(value, { waitUntil: 'load' });

            // Wait for SPA content to load
            await page.waitForTimeout(3000);

            // Ensure page is fully rendered
            await page.waitForFunction(() => {
                return document.readyState === 'complete' &&
                    document.body &&
                    document.body.innerText.trim().length > 100;
            }, { timeout: 10000 });
            break;

        case 'wait':
            if (value === 'network') {
                console.log('⏳ Waiting for network activity to settle...');
                await waitForNetworkSettlement(page);
            } else {
                const ms = parseInt(value, 10) || 2000;
                console.log(`⏳ Waiting for ${ms}ms...`);
                await page.waitForTimeout(ms);
            }
            break;

        case 'back':
            // Navigate back in history
            console.log('↩️ Going back...');
            await page.goBack({ waitUntil: 'load' });
            await page.waitForTimeout(500);
            break;

        case 'forward':
            // Navigate forward
            console.log('↪️ Going forward...');
            await page.goForward({ waitUntil: 'load' });
            await page.waitForTimeout(500);
            break;

        case 'reload':
            console.log('🔄 Reloading page...');
            await page.reload({ waitUntil: 'load' });
            await page.waitForTimeout(1000);
            break;

        case 'click':
        case 'fill':
        case 'hover':
        case 'clear':
        case 'check':
        case 'uncheck':
        case 'select':
            if (!target) {
                throw new Error(`${action} action requires a target element`);
            }
            const locator = await locateElement(page, target);
            await executeAction(locator, action, value);
            break;

        default:
            throw new Error(`Unknown action: ${action}`);
    }
}
