import { Page } from 'puppeteer';
import { GhostCursor } from 'ghost-cursor';
import { setMousePosition } from '../../ghostCursor';

export interface IBody {
    x: number;
    y: number;
    checked: boolean;
}

export default async function execute(page: Page, cursor:GhostCursor, body: IBody) {
      // Move to the element
      if (cursor) {
        await cursor.moveTo({ x: body.x, y: body.y });

        const pos = cursor.getLocation()
        await setMousePosition(page, pos.x, pos.y);
    } else {
        await page.mouse.move(body.x, body.y);
    }

    // Click the element if checked
    if (body.checked) {
        await page.mouse.click(body.x, body.y, {
            clickCount: 1,
            delay: 50,
            button: 'left',
        });
    }
    
    return {}
}