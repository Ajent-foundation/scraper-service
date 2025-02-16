import { Page } from 'puppeteer';
import { GhostCursor, createCursor } from 'ghost-cursor';

export async function setMousePosition(
	page: Page,
	x: number,
	y: number,
) {
	try {
		await page.evaluate((x, y) => {
			//@ts-ignore
			window.mouseX = x;
			//@ts-ignore
			window.mouseY = y;
		}, x, y);
	} catch (error) {
		console.error('WARN setting mouse position:', error);
	}
}

export async function configureGhostCursor(
	page: Page,
	config: any
): Promise<GhostCursor | null> {
	// Apply default config
	if (!config) {

	}

	// Create cursor
	try {
		const { x, y } = await page.evaluate(() => {
			//@ts-ignore
			return { x: window.mouseX || 0, y: window.mouseY || 0 }
		})

		const cursor = createCursor(
			page,
			{
				x,
				y
			},
			true,
			{
				randomMove: {
					randomizeMoveDelay: true,
					moveDelay: 2000,
					//moveSpeed: 10
				},
				move: {
					//moveSpeed: 10
				},
				moveTo: {
					//moveDelay: 2000,
					//randomizeMoveDelay: true,
					//spreadOverride
					//moveSpeed: 10
				},
				click: {
					hesitate: 0,
					waitForClick: 0,
					//moveDelay: 2000
				}
			}
		);

		return cursor;
	} catch (error) {
		console.error('WARN creating ghost cursor:', error);
		return null;
	}
}
