import { Page } from 'puppeteer';
import { GhostCursor } from 'ghost-cursor';
import { setMousePosition } from '../../ghostCursor';

export interface IBody {
	x: number;
	y: number;
}

export default async function execute(
	page: Page,
	cursor: GhostCursor,
	body: IBody,
) {
	// Move to the element
	if (cursor) {
		await cursor.moveTo({ x: body.x, y: body.y });

		const pos = cursor.getLocation();
		await setMousePosition(page, pos.x, pos.y);
	} else {
		await page.mouse.move(body.x, body.y);
	}

	await (async (delay) =>
		new Promise((resolve) => setTimeout(resolve, delay)))(200);

	return {};
}
