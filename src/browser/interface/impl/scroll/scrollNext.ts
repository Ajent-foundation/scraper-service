import { Page } from 'puppeteer';
import { Logger } from 'pino';

export interface IBody {}

export default async function execute(page: Page, log: Logger) {
	// Get initial scroll position and page dimensions
	const initialScrollInfo = await page.evaluate(() => ({
		scrollY: window.scrollY,
		viewportHeight: window.innerHeight,
		totalHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
	}));

	log.info("Initial scroll info:", initialScrollInfo);

	// Check if we're already at or near the bottom
	const isNearBottom = initialScrollInfo.scrollY + initialScrollInfo.viewportHeight >= initialScrollInfo.totalHeight - 10;
	
	if (isNearBottom) {
		log.info("Already at bottom of page, cannot scroll next");
		return { 
			success: false, 
			reason: "already_at_bottom",
			scrollInfo: initialScrollInfo 
		};
	}

	// Try scrolling down by one viewport height
	await page.evaluate(() => {
		window.scrollBy(0, window.innerHeight);
	});

	// Check if scroll worked
	let currentScrollInfo = await page.evaluate(() => ({
		scrollY: window.scrollY,
		viewportHeight: window.innerHeight,
		totalHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
	}));

	let scrollWorked = currentScrollInfo.scrollY > initialScrollInfo.scrollY;
	log.info("After window.scrollBy, scroll worked:", scrollWorked, "Current scrollY:", currentScrollInfo.scrollY);

	// If scrollBy didn't work, try alternative methods
	if (!scrollWorked) {
		// Try scrolling the document element
		await page.evaluate((initialY, viewportHeight) => {
			document.documentElement.scrollTop = initialY + viewportHeight;
		}, initialScrollInfo.scrollY, initialScrollInfo.viewportHeight);

		currentScrollInfo = await page.evaluate(() => ({
			scrollY: window.scrollY,
			viewportHeight: window.innerHeight,
			totalHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
		}));

		scrollWorked = currentScrollInfo.scrollY > initialScrollInfo.scrollY;
		log.info("After documentElement.scrollTop, scroll worked:", scrollWorked, "Current scrollY:", currentScrollInfo.scrollY);
	}

	// If still didn't work, try body scrollTop
	if (!scrollWorked) {
		await page.evaluate((initialY, viewportHeight) => {
			document.body.scrollTop = initialY + viewportHeight;
		}, initialScrollInfo.scrollY, initialScrollInfo.viewportHeight);

		currentScrollInfo = await page.evaluate(() => ({
			scrollY: window.scrollY,
			viewportHeight: window.innerHeight,
			totalHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
		}));

		scrollWorked = currentScrollInfo.scrollY > initialScrollInfo.scrollY;
		log.info("After body.scrollTop, scroll worked:", scrollWorked, "Current scrollY:", currentScrollInfo.scrollY);
	}

	// Last resort: mouse wheel scroll down by viewport height
	if (!scrollWorked) {
		log.info("Standard scroll methods failed, trying mouse wheel");
		await page.mouse.move(500, 300); // Move mouse to center area
		
		// Scroll down by viewport height (positive deltaY scrolls down)
		await page.mouse.wheel({ deltaY: initialScrollInfo.viewportHeight });

		currentScrollInfo = await page.evaluate(() => ({
			scrollY: window.scrollY,
			viewportHeight: window.innerHeight,
			totalHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
		}));

		scrollWorked = currentScrollInfo.scrollY > initialScrollInfo.scrollY;
		log.info("After mouse wheel, scroll worked:", scrollWorked, "Current scrollY:", currentScrollInfo.scrollY);
	}

	// Calculate scroll distance achieved
	const scrollDistance = currentScrollInfo.scrollY - initialScrollInfo.scrollY;
	
	log.info("Scroll next completed:", {
		success: scrollWorked,
		scrollDistance: scrollDistance,
		fromY: initialScrollInfo.scrollY,
		toY: currentScrollInfo.scrollY
	});

	return { 
		success: scrollWorked,
		scrollDistance: scrollDistance,
		initialScrollY: initialScrollInfo.scrollY,
		finalScrollY: currentScrollInfo.scrollY,
		scrollInfo: currentScrollInfo
	};
}
