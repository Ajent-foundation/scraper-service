import { Page } from 'puppeteer';
import { GhostCursor } from 'ghost-cursor';
import { setMousePosition } from '../../ghostCursor';

export interface IBody {
    x: number;
    y: number;
    value: string;
}

export default async function execute(page: Page, cursor:GhostCursor, body: IBody) {
    // Move to the element

    console.log('body qwefmis', body);

    if (cursor) {
        await cursor.moveTo({ x: body.x, y: body.y });

        const pos = cursor.getLocation()
        await setMousePosition(page, pos.x, pos.y);
    } else {
        await page.mouse.move(body.x, body.y);
    }

    // set select value
    await page.evaluate(
        (x, y, valueToSelect) => {
            let selectEl = document.elementFromPoint(x, y);
            // Set the value
            //@ts-ignore
            selectEl.value = valueToSelect;

            console.log('selectEl', selectEl);

            // trigger change event
            //selectEl.dispatchEvent(new Event('change'));
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));

            // trigger input event
            //selectEl.dispatchEvent(new Event('input'));
            selectEl.dispatchEvent(new Event('input', { bubbles: true }));

            // trigger focus event
            //selectEl.dispatchEvent(new Event('focus'));

            // trigger blur event
            //selectEl.dispatchEvent(new Event('blur'));
            selectEl.dispatchEvent(new Event('blur', { bubbles: true }));
        },
        body.x,
        body.y,
        body.value,
    );
    
    return {}
}