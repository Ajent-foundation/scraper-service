import { Page } from 'puppeteer';
import { customScreenshot } from '../../../pages';

export interface IBody {
    x: number;
    y: number;
    width: number;
    height: number;
}

export default async function execute(page: Page, body: IBody) {
    const pageImg = await customScreenshot(
        page,
        body.x,
        body.y,
        body.width,
        body.height,
    )
    
    return {
        img: pageImg,
    }
}