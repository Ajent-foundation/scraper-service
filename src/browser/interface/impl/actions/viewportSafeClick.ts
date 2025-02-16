import { Page } from 'puppeteer';
import { GhostCursor } from 'ghost-cursor';
import { setMousePosition } from '../../ghostCursor';

export interface IBody {
	x: number;
	y: number;
	clickCount: number;
	button: 'left' | 'right' | 'middle';
}

export default async function viewportSafeClick(
	page: Page,
	cursor: GhostCursor | null,
	body: IBody,
) {
	const isInViewport = await page.evaluate(
		({ x, y }) => {
			const viewportHeight = window.innerHeight;
			const viewportWidth = window.innerWidth;
			// Return true if the element is within the viewport
			return (
				x >= 0 && x <= viewportWidth && y >= 0 && y <= viewportHeight
			);
		},
		{ x: body.x, y: body.y },
	);

	if (!isInViewport) {
		await page.evaluate(
			({ x, y }) => {
				window.scrollTo(
					x - window.innerWidth / 2,
					y - window.innerHeight / 2,
				);
			},
			{ x: body.x, y: body.y },
		);
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	if (cursor) {
		await cursor.moveTo({ x: body.x, y: body.y });

		const pos = cursor.getLocation();
		await setMousePosition(page, pos.x, pos.y);
	} else {
		await page.mouse.move(body.x, body.y);
	}

	console.log('CLICK', body.x, body.y);
	console.log('viewport', page.viewport());

	await page.mouse.click(body.x, body.y, {
		clickCount: body.clickCount,
		delay: 50,
		button: body.button,
	});

	return {};
}
