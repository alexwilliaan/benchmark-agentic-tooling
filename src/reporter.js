/**
 * Report Generator - Formats benchmark metrics into readable ASCII tables
 * 
 * Transforms raw performance metrics into a terminal-friendly dashboard
 * with pass/fail indicators based on industry-standard thresholds.
 */

// Industry-standard thresholds for Core Web Vitals
const THRESHOLDS = {
    lcp: { good: 2500, poor: 4000 },      // Largest Contentful Paint (ms)
    inp: { good: 200, poor: 500 },        // Interaction to Next Paint (ms)
    cls: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift
    fcp: { good: 1800, poor: 3000 },      // First Contentful Paint (ms)
    tbt: { good: 200, poor: 600 },        // Total Blocking Time (ms)
    jsHeap: { warning: 50 },              // JS Heap in MB
};

/**
 * Determine status based on value and thresholds
 * @param {number} value - The metric value
 * @param {object} threshold - Object with good and poor thresholds
 * @returns {string} Status indicator
 */
function getStatus(value, threshold) {
    if (value <= threshold.good) return '✅ PASS';
    if (value >= threshold.poor) return '❌ POOR';
    return '⚠️  NEEDS IMPROVEMENT';
}

/**
 * Format number with commas for thousands
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
    return num.toLocaleString('en-US');
}

/**
 * Pad string to specified length
 * @param {string} str - String to pad
 * @param {number} length - Target length
 * @returns {string} Padded string
 */
function padString(str, length) {
    return str.padEnd(length, ' ');
}

/**
 * Format Core Web Vitals section
 * @param {object} vitals - Vitals metrics
 * @returns {string} Formatted table
 */
function formatCoreVitals(vitals) {
    const separator = ' ---------------------------------------------------------------';
    const header = ' Metric    | Value       | Target      | Status';

    const rows = [
        {
            metric: 'LCP',
            value: `${formatNumber(Math.round(vitals.lcp))} ms`,
            target: '< 2,500 ms',
            status: getStatus(vitals.lcp, THRESHOLDS.lcp),
        },
        {
            metric: 'INP',
            value: `${formatNumber(Math.round(vitals.inp))} ms`,
            target: '< 200 ms',
            status: getStatus(vitals.inp, THRESHOLDS.inp),
        },
        {
            metric: 'CLS',
            value: vitals.cls.toFixed(4),
            target: '< 0.1',
            status: getStatus(vitals.cls, THRESHOLDS.cls),
        },
    ];

    let output = ' CORE WEB VITALS (UX)\n';
    output += separator + '\n';
    output += header + '\n';
    output += separator + '\n';

    rows.forEach(row => {
        output += ` ${padString(row.metric, 9)} | ${padString(row.value, 11)} | ${padString(row.target, 11)} | ${row.status}\n`;
    });

    return output;
}

/**
 * Format System & Resources section
 * @param {object} cdp - CDP metrics
 * @param {object} diagnostics - Diagnostics from observer
 * @returns {string} Formatted table
 */
function formatSystemDiagnostics(cdp, diagnostics) {
    const separator = ' ---------------------------------------------------------------';
    const header = ' Metric    | Value       | Context     | Status';

    const jsHeapUsed = parseFloat(cdp.jsHeap.usedMB);
    const jsHeapStatus = jsHeapUsed > THRESHOLDS.jsHeap.warning ? '⚠️  HIGH' : '✅ PASS';

    const tbtValue = cdp.tbt;
    const tbtStatus = tbtValue === 0 ? '✅ PASS' : getStatus(tbtValue, THRESHOLDS.tbt);

    const consoleErrorStatus = cdp.consoleErrors.length > 0 ? `⚠️  ${cdp.consoleErrors.length} errors` : '✅ PASS';

    const rows = [
        {
            metric: 'TBT',
            value: `${formatNumber(Math.round(tbtValue))} ms`,
            context: 'Blocking',
            status: tbtStatus,
        },
        {
            metric: 'JS Heap',
            value: `${cdp.jsHeap.usedMB} MB`,
            context: 'Used',
            status: jsHeapStatus,
        },
        {
            metric: 'Long Tasks',
            value: `${diagnostics.longTasks}`,
            context: 'Count',
            status: diagnostics.longTasks === 0 ? '✅ PASS' : '⚠️  DETECTED',
        },
        {
            metric: 'Requests',
            value: `${cdp.resources.count}`,
            context: 'Network',
            status: '-- OK',
        },
        {
            metric: 'Errors',
            value: `${cdp.consoleErrors.length}`,
            context: 'Console',
            status: consoleErrorStatus,
        },
    ];

    let output = '\n SYSTEM & RESOURCES\n';
    output += separator + '\n';
    output += header + '\n';
    output += separator + '\n';

    rows.forEach(row => {
        output += ` ${padString(row.metric, 9)} | ${padString(row.value, 11)} | ${padString(row.context, 11)} | ${row.status}\n`;
    });

    return output;
}

/**
 * Format detailed diagnostics (long tasks, console errors)
 * @param {object} diagnostics - Diagnostics from observer
 * @param {object} cdp - CDP metrics
 * @returns {string} Formatted details
 */
function formatDetails(diagnostics, cdp) {
    let output = '';

    // Long tasks details
    if (diagnostics.longTasks > 0) {
        output += '\n 🔍 LONG TASKS DETECTED\n';
        output += ' ---------------------------------------------------------------\n';
        diagnostics.scripts.forEach((script, idx) => {
            output += `  ${idx + 1}. Duration: ${Math.round(script.duration)}ms at ${Math.round(script.startTime)}ms\n`;
            if (script.source !== 'unknown') {
                output += `     Source: ${script.source}\n`;
            }
        });
    }

    // Console errors
    if (cdp.consoleErrors.length > 0) {
        output += '\n ⚠️  CONSOLE ERRORS\n';
        output += ' ---------------------------------------------------------------\n';
        cdp.consoleErrors.forEach((error, idx) => {
            output += `  ${idx + 1}. ${error.text}\n`;
            if (error.location && error.location.url) {
                output += `     Location: ${error.location.url}\n`;
            }
        });
    }

    // Network errors
    if (cdp.resources.errors.length > 0) {
        output += '\n ❌ NETWORK ERRORS\n';
        output += ' ---------------------------------------------------------------\n';
        cdp.resources.errors.forEach((error, idx) => {
            output += `  ${idx + 1}. ${error.url}\n`;
            output += `     Failure: ${error.failure}\n`;
        });
    }

    return output;
}

/**
 * Generate complete benchmark report
 * @param {object} metrics - Complete metrics object
 * @param {string} url - Target URL
 * @returns {string} Formatted report
 */
export function generateReport(metrics, url) {
    const separator = '===============================================================';

    let report = '';

    // Header
    report += separator + '\n';
    report += ' BENCHMARK REPORT\n';
    report += ` Target: ${url}\n`;
    report += ' Browser: Chromium | Viewport: 1920x1080\n';
    report += separator + '\n\n';

    // Core Web Vitals
    report += formatCoreVitals(metrics.vitals);

    // System & Resources
    report += formatSystemDiagnostics(metrics.cdp, metrics.diagnostics);

    // Details (if any issues found)
    const details = formatDetails(metrics.diagnostics, metrics.cdp);
    if (details) {
        report += details;
    }

    // Footer
    report += '\n' + separator + '\n';

    return report;
}
