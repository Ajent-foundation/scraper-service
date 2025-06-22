import { Page } from 'puppeteer';
import { Logger } from 'pino';

export interface IBody {
    x: number;
    y: number;
}

export default async function execute(
    page:Page,
    body:IBody,
    log:Logger
) {
    await page.evaluate(
        (x, y) => {
            window.scrollTo(x, y);
        },
        body.x,
        body.y,
    );
    

    log.info("page", page)

    return {}
}