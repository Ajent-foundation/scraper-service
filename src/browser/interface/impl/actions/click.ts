import { Page } from 'puppeteer';
import { GhostCursor } from 'ghost-cursor';
import { setMousePosition } from '../../ghostCursor';

export interface IBody {
    x: number;
    y: number;
    clickCount: number;
    button: 'left' | 'right' | 'middle';
}

export default async function execute(
	page: Page,
	cursor: GhostCursor,
	body: IBody,
) {
	try {
		// Move to the element
		if (cursor) {
			await cursor.moveTo({ x: body.x, y: body.y });

			const pos = cursor.getLocation();
			await setMousePosition(page, pos.x, pos.y);
		} else {
			await page.mouse.move(body.x, body.y);
		}

		// Click the element
		await page.mouse.click(body.x, body.y, {
			clickCount: body.clickCount,
			delay: 50,
			button: body.button,
		});

		// Wait for navigation to complete if it happens

		return {};
	} catch (error) {
		console.error('Error during click operation:', error.message);
		// Return empty object to maintain the expected return type
		return {};
	}
}
