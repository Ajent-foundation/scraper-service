import { TBrowserContext } from "./types.js";
import { getCurrentPage } from "../../../browser/pages/index";
import { Browser, Page } from "puppeteer";

/**
 * Get browser and page from context, or get current page if browser is provided but page is not
 */
export async function getBrowserAndPage(
    ctx: TBrowserContext
): Promise<{ browser: Browser; page: Page; index: number }> {
    // Fallback: get current page if browser is provided but page is not
    if (!ctx.puppeteerBrowser) {
        throw new Error("Browser must be provided in context (puppeteerBrowser)");
    }

    const { page, index } = await getCurrentPage(
        ctx.ctx.logger,
        ctx.importantHeaders || {},
        ctx.puppeteerBrowser,
        ctx.session.config
    );

    return { browser: ctx.puppeteerBrowser, page, index };
}

