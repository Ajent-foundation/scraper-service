import { Page } from 'puppeteer';
import { Logger } from 'pino';

export interface IBody {}

export default async function execute(page: Page, log: Logger) {
    const MAX_ATTEMPTS = 3;
    const TIMEOUT_MS = 5000; // 5 second timeout
    const startTime = Date.now();
    
    let attempt = 0;
    let previousHeight = 0;
    let stableHeightCount = 0;
    
    while (attempt < MAX_ATTEMPTS && (Date.now() - startTime) < TIMEOUT_MS) {
        attempt++;
        log.info(`Scroll to bottom attempt ${attempt}/${MAX_ATTEMPTS}`);
        
        // Get current page dimensions
        let scrollInfo = await page.evaluate(() => ({
            scrollY: window.scrollY,
            scrollHeight: document.body.scrollHeight,
            windowHeight: window.innerHeight,
            documentScrollHeight: document.documentElement.scrollHeight
        }));
        
        const currentHeight = Math.max(scrollInfo.scrollHeight, scrollInfo.documentScrollHeight);
        
        // Check if page height is stable (not infinitely growing)
        if (currentHeight === previousHeight) {
            stableHeightCount++;
        } else {
            stableHeightCount = 0;
            previousHeight = currentHeight;
        }
        
        // If height has been stable for 2 checks, we can trust it's not infinite scroll
        const isStableHeight = stableHeightCount >= 2;
        
        log.info("Page height info:", {
            currentHeight,
            previousHeight,
            isStableHeight,
            scrollY: scrollInfo.scrollY
        });
        
        // Try scrolling to bottom
        if (attempt === 1) {
            // First attempt: direct scrollTo
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
        } else if (attempt === 2) {
            // Second attempt: try document element
            await page.evaluate(() => {
                const maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
                document.documentElement.scrollTop = maxScroll;
            });
        } else {
            // Third attempt: try body scrollTop
            await page.evaluate(() => {
                const maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
                document.body.scrollTop = maxScroll;
            });
        }
        
        // Short delay to allow any dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check final position
        scrollInfo = await page.evaluate(() => ({
            scrollY: window.scrollY,
            scrollHeight: document.body.scrollHeight,
            windowHeight: window.innerHeight,
            documentScrollHeight: document.documentElement.scrollHeight
        }));
        
        const finalHeight = Math.max(scrollInfo.scrollHeight, scrollInfo.documentScrollHeight);
        const isAtBottom = scrollInfo.scrollY + scrollInfo.windowHeight >= finalHeight - 10;
        
        log.info(`Attempt ${attempt} result:`, {
            isAtBottom,
            scrollY: scrollInfo.scrollY,
            finalHeight,
            distanceFromBottom: finalHeight - (scrollInfo.scrollY + scrollInfo.windowHeight)
        });
        
        // Success conditions
        if (isAtBottom && isStableHeight) {
            log.info("Successfully reached bottom of page");
            return { 
                success: true, 
                scrollInfo: scrollInfo,
                attempts: attempt,
                reason: "reached_bottom"
            };
        }
        
        // If we're at bottom but height is still changing, it might be infinite scroll
        if (isAtBottom && !isStableHeight) {
            log.warn("Reached bottom but page height is still changing - possible infinite scroll");
            return { 
                success: false, 
                scrollInfo: scrollInfo,
                attempts: attempt,
                reason: "infinite_scroll_detected"
            };
        }
        
        // If height changed significantly, it's likely infinite scroll
        if (finalHeight > previousHeight + 1000) {
            log.warn("Page height increased significantly - infinite scroll detected");
            return { 
                success: false, 
                scrollInfo: scrollInfo,
                attempts: attempt,
                reason: "height_growing_too_fast"
            };
        }
    }
    
    // If we've exhausted attempts or hit timeout
    const finalScrollInfo = await page.evaluate(() => ({
        scrollY: window.scrollY,
        scrollHeight: document.body.scrollHeight,
        windowHeight: window.innerHeight,
        documentScrollHeight: document.documentElement.scrollHeight
    }));
    
    const reason = (Date.now() - startTime) >= TIMEOUT_MS ? "timeout" : "max_attempts_exceeded";
    
    log.warn(`Failed to scroll to bottom: ${reason}`, {
        attempts: attempt,
        timeElapsed: Date.now() - startTime,
        finalPosition: finalScrollInfo.scrollY
    });
    
    return { 
        success: false, 
        scrollInfo: finalScrollInfo,
        attempts: attempt,
        reason: reason
    };
}