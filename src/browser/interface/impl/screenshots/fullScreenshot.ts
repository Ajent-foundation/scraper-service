import { Page } from 'puppeteer';
import { takePageScreenshot } from '../../../pages';
import { BrowserConfig } from '../../../../apis/browsers-cmgr';
import { Logger } from 'pino';

export interface IBody {
    config: BrowserConfig;
    fullPage: boolean;
}

export default async function execute(logger: Logger, headers: Record<string, string>, page: Page, body: IBody) {
    const pageImg = await takePageScreenshot(
        logger,
        headers,
        page,
        body.config,
        body.fullPage,
        "jpeg"
    );
    
    return {
        img: pageImg,
    }
}