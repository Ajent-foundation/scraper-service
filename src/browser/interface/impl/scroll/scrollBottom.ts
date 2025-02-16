import { Page } from 'puppeteer';

export interface IBody {}

export default async function execute(page: Page) {
    await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
    });
    
    return {}
}