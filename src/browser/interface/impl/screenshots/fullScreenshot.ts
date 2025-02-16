import { Page } from 'puppeteer';
import { takePageScreenshot } from '../../../pages';
import { BrowserConfig } from '../../../../apis/browsers-cmgr';

export interface IBody {
    config: BrowserConfig;
    fullPage: boolean;
}

export default async function execute(page: Page, body: IBody) {
    const pageImg = await takePageScreenshot(
        page,
        body.config,
        body.fullPage,
        "jpeg"
    );
    
    return {
        img: pageImg,
    }
}