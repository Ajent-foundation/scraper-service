import { TContext } from "../../core/common/index.js";
import { BrowserSession } from "../../../apis/browsers-cmgr.js";
import { Page, Browser } from "puppeteer";

/**
 * Browser context type for tools
 */
export type TBrowserContext = {
    ctx: TContext;
    session: BrowserSession;
    sessionID: string;
    importantHeaders?: Record<string, string>;
    puppeteerBrowser?: Browser;
    page?: Page;
    pageIndex?: number;
    envVariables?: Record<string, string>;
};

