/**
 * Phase 1: Performance Observer Injection Script
 *
 * This script initializes the performance monitoring metrics.
 * It stores all data in window.__BENCHMARK_METRICS__ for Playwright to retrieve later.
 */

(function () {
    // 1. Initialize the global storage object
    window.__BENCHMARK_METRICS__ = {
        vitals: {
            lcp: 0, // Largest Contentful Paint
            cls: 0, // Cumulative Layout Shift
            inp: 0, // Interaction to Next Paint (estimated via max interaction duration)
        },
        diagnostics: {
            longTasks: 0, // Count of tasks > 50ms
            longTasksTotalDuration: 0, // Total time blocked
            scripts: [], // List of scripts causing long tasks
        },
        interactions: [], // specific interaction logs for bottleneck analysis
    };

    const metrics = window.__BENCHMARK_METRICS__;

    // 2. Observer for LCP (Largest Contentful Paint)
    // LCP can update multiple times as the page loads. We want the last valid one.
    new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
            metrics.vitals.lcp = lastEntry.renderTime || lastEntry.loadTime || lastEntry.startTime;
        }
    }).observe({ type: "largest-contentful-paint", buffered: true });

    // 3. Observer for CLS (Cumulative Layout Shift)
    // We sum up the score of unexpected layout shifts.
    new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
            // Only count shifts that were NOT caused by user interaction
            if (!entry.hadRecentInput) {
                metrics.vitals.cls += entry.value;
            }
        }
    }).observe({ type: "layout-shift", buffered: true });

    // 4. Observer for INP (Interaction to Next Paint) & Long Interactions
    // We observe 'event' entries to track duration of clicks/keypresses.
    // Note: This requires 'event-timing' API support (modern browsers).
    try {
        new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                // We act if the interaction took longer than a small threshold (e.g. 50ms)
                // 'duration' in the Event Timing API covers the full latency.
                if (entry.interactionId) {
                    // Keep track of the worst interaction for INP
                    if (entry.duration > metrics.vitals.inp) {
                        metrics.vitals.inp = entry.duration;
                    }

                    // Log detail if it was slow (e.g., > 200ms) for our bottleneck report
                    if (entry.duration > 200) {
                        metrics.interactions.push({
                            name: entry.name,
                            startTime: entry.startTime,
                            duration: entry.duration,
                            target: entry.target ? entry.target.tagName : "Unknown",
                        });
                    }
                }
            }
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    } catch (e) {
        console.warn("Browser does not support Event Timing API for INP.");
    }

    // 5. Observer for Long Tasks (Main Thread Blocking)
    // This helps us calculate TBT (Total Blocking Time) approximation and find bad scripts.
    new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
            metrics.diagnostics.longTasks++;
            metrics.diagnostics.longTasksTotalDuration += entry.duration;

            // Try to identify the culprit (attribution is limited in standard API, but we try)
            if (entry.attribution && entry.attribution.length > 0) {
                metrics.diagnostics.scripts.push({
                    source: entry.attribution[0].containerSrc || "unknown",
                    duration: entry.duration,
                    startTime: entry.startTime,
                });
            }
        }
    }).observe({ type: "longtask", buffered: true });

    console.log("Benchmarks: Observer is active.");
})();