import { Page } from 'puppeteer';

export interface IBody {
    x: number;
    y: number;
}

export default async function execute(
    page:Page,
    body:IBody
) {
    await page.evaluate(
        (x, y) => {
            window.scrollTo(x, y);
        },
        body.x,
        body.y,
    );
    
    return {}
}