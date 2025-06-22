import { Page } from 'puppeteer';
import { Logger } from 'pino';

export interface IBody {}

export default async function execute(page: Page, log: Logger) {
    // First, try the most reliable method - direct scrollTo
    await page.evaluate(() => {
        window.scrollTo(0, 0);
    });

    // Check if we reached the top
    let currentScroll = await page.evaluate(() => window.scrollY);
    log.info("After scrollTo(0,0), scrollY:", currentScroll);

    // If not at top, try alternative methods
    if (currentScroll > 0) {
        // Try scrolling the document element
        await page.evaluate(() => {
            document.documentElement.scrollTop = 0;
        });
        
        currentScroll = await page.evaluate(() => window.scrollY);
        log.info("After documentElement.scrollTop = 0, scrollY:", currentScroll);
    }

    // If still not at top, try body scrollTop
    if (currentScroll > 0) {
        await page.evaluate(() => {
            document.body.scrollTop = 0;
        });
        
        currentScroll = await page.evaluate(() => window.scrollY);
        log.info("After body.scrollTop = 0, scrollY:", currentScroll);
    }

    // If still not at top, try mouse wheel scroll up
    if (currentScroll > 0) {
        log.info("Standard scroll methods failed, trying mouse wheel");
        await page.mouse.move(500, 300); // Move mouse to center area
        
        // Scroll up with negative deltaY (positive scrolls down)
        await page.mouse.wheel({ deltaY: -1000 });
        
        currentScroll = await page.evaluate(() => window.scrollY);
        log.info("After mouse wheel scroll, scrollY:", currentScroll);
    }

    // Final verification
    const isAtTop = currentScroll === 0;
    log.info("Successfully scrolled to top:", isAtTop);
    
    if (!isAtTop) {
        log.warn("Failed to scroll to top. Final scroll position:", currentScroll);
    }

    return { success: isAtTop, finalScrollY: currentScroll };
}