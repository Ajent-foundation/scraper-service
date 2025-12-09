import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { getBrowserAndPage } from "../utils";
import { awaitPageTillLoaded, waitTillNotBlankPage } from "../../../../browser/pages/awaitPage/index";
import { getPageCount, getPageAtIndex } from "../../../../browser/pages/index";
import { z } from "zod";

export const goToPage: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "goToPage",
    description: "Navigate to a specific URL. This will load the page and wait for it to be fully loaded.",
    zodParameters: z.object({
        url: z.url().describe("The URL to navigate to (must start with http:// or https://)"),
        fullPage: z.boolean().optional().describe("Whether to wait for full page load including all resources"),
        stayOnPage: z.boolean().optional().describe("Whether to stay on the current page if navigation opens a new tab"),
    }),
    implementation: async (global, args) => {
        const { browser, page, index } = await getBrowserAndPage(global);
        
        // Direct puppeteer implementation
        try {
            await page.evaluateOnNewDocument(() => {
                window.alert = () => {};
                window.confirm = () => true;
                window.prompt = (message, defaultValue) => defaultValue || '';
            });

            await page.goto(args.url, {
                waitUntil: args.fullPage ? 'load' : 'domcontentloaded',
                timeout: 30000,
            });
        } catch (error) {
            global.ctx.logger.warn({
                message: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined,
            }, "ERROR_GOING_TO_PAGE");
        }

        // Wait for page to be loaded
        const settings = {
            encoding: 'binary' as const,
            fullPage: false,
        };

        let retryAttempts = 3;
        let hasPageChanged = false;
        const initialPageCount = await getPageCount(browser as any);
        let currentPage = page;
        let currentIndex = index;

        while (retryAttempts > 0) {
            try {
                await waitTillNotBlankPage(currentPage as any);
                await awaitPageTillLoaded(
                    global.ctx.logger,
                    global.importantHeaders || {},
                    browser as any,
                    currentIndex,
                    10,
                    10000,
                    settings,
                );

                if (!args.stayOnPage) {
                    const newPageCount = await getPageCount(browser as any);
                    if (newPageCount > initialPageCount) {
                        hasPageChanged = true;
                        const currPageIndex = newPageCount - 1;
                        const newPageResult = await getPageAtIndex(
                            global.ctx.logger,
                            global.importantHeaders || {},
                            browser as any,
                            global.session.config,
                            currPageIndex
                        );
                        currentPage = newPageResult.page as any;
                        currentIndex = currPageIndex;

                        await waitTillNotBlankPage(currentPage as any);
                        await awaitPageTillLoaded(
                            global.ctx.logger,
                            global.importantHeaders || {},
                            browser as any,
                            currentIndex,
                            150,
                            10000,
                            settings,
                        );
                        await currentPage.bringToFront();
                    }
                }

                break;
            } catch (error) {
                if (error instanceof Error && error.message.includes('Execution context was destroyed')) {
                    retryAttempts--;
                    continue;
                }
                throw error;
            }
        }

        return { text: JSON.stringify({ 
            message: `Navigated to ${args.url}`,
            url: currentPage.url(),
            hasPageChanged,
        }), base64Images: [] };
    },
};
