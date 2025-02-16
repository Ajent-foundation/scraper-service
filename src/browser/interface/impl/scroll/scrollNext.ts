import { Page } from 'puppeteer';

export interface IBody {}

export default async function execute(page: Page) {
	const noScroll = await page.evaluate(async () => {
        var initialScroll = window.scrollY;
        window.scrollBy(0, window.innerHeight);

        if (window.scrollY === initialScroll) {
            document.body.scrollTop += window.innerHeight;
        }

        // Return true if scroll did not change
        return window.scrollY === initialScroll;
	})


    if (noScroll) {
        const totalHeight = await page.evaluate(
            () => document.documentElement.scrollHeight,
        );
        // If the page didn't scroll with window.scrollBy, use mouse wheel
        await page.mouse.move(500, totalHeight / 2); // Move mouse to a position
        await page.mouse.wheel({ deltaY: -totalHeight }); // Scroll down
    }

    return {}
}
