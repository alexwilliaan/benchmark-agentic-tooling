/**
 * Semantic Element Locator
 * 
 * Finds elements on the page based on semantic descriptions from the AI agent.
 * Uses Playwright's built-in locators for robust element selection.
 */

/**
 * Locate an element based on semantic description
 * @param {Page} page - Playwright page object
 * @param {string} target - Semantic description (e.g., "Login Button", "Email")
 * @returns {Promise<Locator>} Playwright locator
 * @throws {Error} If element cannot be found
 */
export async function locateElement(page, target) {
    // Clean up the target string
    const cleanTarget = target.trim();

    // Try multiple strategies in order of reliability
    const strategies = [
        // Strategy 0: Direct CSS/XPath selector (if target looks like one)
        async () => {
            // Simple heuristic: if it looks like a selector
            if (cleanTarget.startsWith('#') || cleanTarget.startsWith('.') || cleanTarget.startsWith('[')) {
                try {
                    const locator = page.locator(cleanTarget);
                    // Check if *any* count exists to consider it found.
                    // Note: page.locator() doesn't throw on creation, only on action if strict.
                    // But here we just want to know if it points to something.
                    if (await locator.count() > 0) return locator.first();
                } catch (e) {
                    return null;
                }
            }
            return null;
        },

        // Strategy 1: Try as button by role
        async () => {
            try {
                const locator = page.getByRole('button', { name: new RegExp(cleanTarget, 'i') });
                if (await locator.count() > 0) return locator.first();
            } catch (e) {
                return null;
            }
        },

        // Strategy 2: Try as link by role
        async () => {
            try {
                const locator = page.getByRole('link', { name: new RegExp(cleanTarget, 'i') });
                if (await locator.count() > 0) return locator.first();
            } catch (e) {
                return null;
            }
        },

        // Strategy 3: Try as input by label
        async () => {
            try {
                const locator = page.getByLabel(new RegExp(cleanTarget, 'i'));
                if (await locator.count() > 0) return locator.first();
            } catch (e) {
                return null;
            }
        },

        // Strategy 4: Try as input by placeholder
        async () => {
            try {
                const locator = page.getByPlaceholder(new RegExp(cleanTarget, 'i'));
                if (await locator.count() > 0) return locator.first();
            } catch (e) {
                return null;
            }
        },

        // Strategy 5: Try by exact text
        async () => {
            try {
                const locator = page.getByText(cleanTarget, { exact: true });
                if (await locator.count() > 0) return locator.first();
            } catch (e) {
                return null;
            }
        },

        // Strategy 6: Try by partial text match
        async () => {
            try {
                const locator = page.getByText(new RegExp(cleanTarget, 'i'));
                if (await locator.count() > 0) return locator.first();
            } catch (e) {
                return null;
            }
        },

        // Strategy 7: Try as heading
        async () => {
            try {
                const locator = page.getByRole('heading', { name: new RegExp(cleanTarget, 'i') });
                if (await locator.count() > 0) return locator.first();
            } catch (e) {
                return null;
            }
        },
    ];

    // Try each strategy
    for (const strategy of strategies) {
        const locator = await strategy();
        if (locator) {
            return locator;
        }
    }

    // If nothing found, throw detailed error
    throw new Error(
        `Could not locate element: "${target}"\n` +
        `Tried multiple strategies:\n` +
        `  - Button with name matching "${target}"\n` +
        `  - Link with name matching "${target}"\n` +
        `  - Input with label matching "${target}"\n` +
        `  - Input with placeholder matching "${target}"\n` +
        `  - Element with text matching "${target}"\n` +
        `  - Heading with text matching "${target}"\n` +
        `\nPlease verify the element exists and is visible on the page.`
    );
}

/**
 * Execute an action on a located element
 * @param {Locator} locator - Playwright locator
 * @param {string} action - Action to perform (click, fill, etc.)
 * @param {string} value - Value for fill actions
 */
export async function executeAction(locator, action, value = null) {
    switch (action) {
        case 'click':
            await locator.click();
            break;

        case 'fill':
            if (!value) {
                throw new Error('Fill action requires a value');
            }
            // Check if enabled first to give a better error message than generic timeout
            try {
                const isEnabled = await locator.isEnabled({ timeout: 1000 });
                if (!isEnabled) {
                    throw new Error('Element found but is disabled (not editable)');
                }
            } catch (e) {
                // If checking enabled status fails (e.g. element gone), let standard fill handle it or rethrow
                if (e.message.includes('Element found but is disabled')) throw e;
            }
            await locator.fill(value);
            break;

        case 'clear':
            await locator.clear();
            break;

        case 'check':
            await locator.check();
            break;

        case 'uncheck':
            await locator.uncheck();
            break;

        case 'select':
            if (!value) {
                throw new Error('Select action requires a value');
            }
            await locator.selectOption(value);
            break;

        case 'hover':
            await locator.hover();
            break;

        default:
            throw new Error(`Unknown action: ${action}`);
    }
}
