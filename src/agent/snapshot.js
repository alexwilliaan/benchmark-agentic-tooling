/**
 * DOM Snapshot Generator
 * 
 * Generates simplified, semantic representations of the DOM for AI agent consumption.
 * Focuses on interactive elements with human-readable labels.
 */

/**
 * Generate a simplified DOM snapshot for the agent
 * @param {Page} page - Playwright page object
 * @returns {Promise<string>} Simplified DOM representation
 */
export async function generateSnapshot(page) {
    const snapshot = await page.evaluate(() => {
        const elements = [];

        // Helper to check if element is visible
        function isVisible(element) {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                element.offsetParent !== null;
        }

        // Helper to get element text content (trimmed)
        function getTextContent(element) {
            return element.textContent?.trim() || '';
        }

        // Helper to get accessible name
        function getAccessibleName(element) {
            // Check aria-label
            if (element.getAttribute('aria-label')) {
                return element.getAttribute('aria-label');
            }

            // Check aria-labelledby
            const labelledBy = element.getAttribute('aria-labelledby');
            if (labelledBy) {
                const labelElement = document.getElementById(labelledBy);
                if (labelElement) {
                    return getTextContent(labelElement);
                }
            }

            // For inputs, check associated label
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
                const id = element.id;
                if (id) {
                    const label = document.querySelector(`label[for="${id}"]`);
                    if (label) {
                        return getTextContent(label);
                    }
                }

                // Check parent label
                const parentLabel = element.closest('label');
                if (parentLabel) {
                    return getTextContent(parentLabel);
                }

                // Fallback to placeholder
                if (element.placeholder) {
                    return element.placeholder;
                }

                // Fallback to name attribute
                if (element.name) {
                    return element.name;
                }
            }

            return null;
        }

        // Extract buttons
        document.querySelectorAll('button, [role="button"]').forEach(button => {
            if (!isVisible(button)) return;

            const text = getAccessibleName(button) || getTextContent(button);
            if (text) {
                elements.push(`[Button: "${text}"]`);
            }
        });

        // Extract links
        document.querySelectorAll('a[href]').forEach(link => {
            if (!isVisible(link)) return;

            const text = getAccessibleName(link) || getTextContent(link);
            if (text) {
                elements.push(`[Link: "${text}"]`);
            }
        });

        // Extract inputs
        document.querySelectorAll('input, textarea').forEach(input => {
            if (!isVisible(input)) return;

            const type = input.type || 'text';
            const label = getAccessibleName(input);

            if (label) {
                elements.push(`[Input: "${label}" (${type})]`);
            } else if (input.placeholder) {
                elements.push(`[Input: "${input.placeholder}" (${type})]`);
            }
        });

        // Extract selects
        document.querySelectorAll('select').forEach(select => {
            if (!isVisible(select)) return;

            const label = getAccessibleName(select);
            if (label) {
                elements.push(`[Select: "${label}"]`);
            }
        });

        // Extract headings for context
        document.querySelectorAll('h1, h2, h3').forEach(heading => {
            if (!isVisible(heading)) return;

            const text = getTextContent(heading);
            if (text) {
                const level = heading.tagName;
                elements.push(`[Heading ${level}: "${text}"]`);
            }
        });

        return elements;
    });

    // Format as text
    if (snapshot.length === 0) {
        return '[Empty page - no interactive elements found]';
    }

    return snapshot.join('\n');
}

/**
 * Get current page URL and title for context
 * @param {Page} page - Playwright page object
 * @returns {Promise<object>} Page context
 */
export async function getPageContext(page) {
    return {
        url: page.url(),
        title: await page.title(),
    };
}
