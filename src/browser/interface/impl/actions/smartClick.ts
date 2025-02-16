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
	// Get the element
	let commandRes = await page.evaluate(
		(x, y) => {
			let element = document.elementFromPoint(x, y);
			if (element) {
				// check if element is iframe
				if (element.tagName == 'IFRAME') {
					return -1;
				}

				try {
					(element as HTMLElement).click();
					return 1;
				} catch (err) {
					return -1;
				}
			}

			return -1;
		},
		body.x,
		body.y,
	);

	// Becomes regular click
	if (commandRes == -1) {
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
	}

	return {};
}
