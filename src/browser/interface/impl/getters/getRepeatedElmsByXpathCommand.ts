import { Page } from 'puppeteer';
import { findRepeatedXpath } from '../../../../webFuncs/findRepeatedXpath';

export interface IBody {
    elmsCoords:  { x: number; y: number; tagName: string; }[];
}

export default async function execute(page: Page, body: IBody) {
    const repeatedElms = await page.evaluate(
        findRepeatedXpath,
        body.elmsCoords,
    );

    return { elms: repeatedElms }
}