/**
 * Flow Executor
 * 
 * Executes AI-driven user flows by coordinating between the agent,
 * DOM snapshots, and Playwright actions.
 */

import { generateSnapshot, getPageContext } from './snapshot.js';
import { locateElement, executeAction } from './locator.js';

/**
 * Execute a user flow with AI agent guidance
 * @param {Page} page - Playwright page object
 * @param {string} flowDescription - Natural language flow description
 * @param {Function} agentDecide - Function that takes (snapshot, instruction, history) and returns {action, target, value}
 * @returns {Promise<object>} Execution result with history and metrics
 */
export async function executeFlow(page, flowDescription, agentDecide) {
    const history = [];
    const startTime = Date.now();
    let stepCount = 0;
    const maxSteps = 50; // Safety limit

    console.log('🤖 Starting AI-driven flow execution');
    console.log(`📝 Flow: ${flowDescription}`);
    console.log('');

    try {
        while (stepCount < maxSteps) {
            console.log(`🔄 Loop iteration ${stepCount}/${maxSteps}`);
            stepCount++;

            // Get current page state
            const context = await getPageContext(page);
            const snapshot = await generateSnapshot(page);

            console.log(`\n━━━ Step ${stepCount} ━━━`);
            console.log(`📍 Current page: ${context.url}`);
            console.log(`📄 Title: ${context.title}`);

            // Get agent decision
            console.log('🤔 Asking agent for next action...');
            const decision = await agentDecide(snapshot, flowDescription, history);

            // Check if flow is complete
            if (decision.action === 'done') {
                console.log('✅ Agent signaled flow completion');
                break;
            }

            // Log the decision
            console.log(`🎯 Action: ${decision.action}`);
            if (decision.target) console.log(`   Target: "${decision.target}"`);
            if (decision.value) console.log(`   Value: "${decision.value}"`);

            // Execute the action
            await executeStep(page, decision);

            // Record in history
            history.push({
                step: stepCount,
                url: context.url,
                action: decision.action,
                target: decision.target,
                value: decision.value ? '***' : undefined, // Mask sensitive values
                timestamp: Date.now() - startTime,
            });

            console.log('✓ Step completed');
        }

        if (stepCount >= maxSteps) {
            throw new Error(`Flow exceeded maximum steps (${maxSteps}). Possible infinite loop.`);
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
        const snapshot = await generateSnapshot(page);

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
        console.error('Available elements on page:');
        console.error(snapshot);
        console.error('');
        console.error('Action history:');
        history.forEach((h, i) => {
            console.error(`  ${i + 1}. ${h.action} ${h.target || ''} at ${h.url}`);
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
            // Wait for SPA to load
            console.log('⏳ Waiting for page to fully load...');
            await page.waitForTimeout(2000);
            break;

        case 'click':
        case 'fill':
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
