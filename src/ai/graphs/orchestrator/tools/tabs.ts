import { z } from "zod";
import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";

/**
 * List all open tabs with their titles and URLs (used internally, not exposed as tool)
 */
export const listTabs: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "listTabs",
    description: "List all open browser tabs with their index, title, and URL. Use this to see what tabs are currently open.",
    zodParameters: z.object({}),
    implementation: async (global, params) => {
        const browser = global.puppeteerBrowser;
        const pages = await browser.pages();
        
        const tabsInfo: { index: number; title: string; url: string; isCurrent: boolean }[] = [];
        
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            try {
                const title = await page.title();
                const url = page.url();
                const isCurrent = page === global.page;
                tabsInfo.push({ index: i, title: title || "(No title)", url, isCurrent });
            } catch (e) {
                tabsInfo.push({ index: i, title: "(Error reading tab)", url: "(unknown)", isCurrent: false });
            }
        }
        
        const tabsList = tabsInfo.map(tab => 
            `${tab.isCurrent ? "→ " : "  "}[${tab.index}] ${tab.title} - ${tab.url}`
        ).join("\n");
        
        return {
            text: `Open tabs (${tabsInfo.length}):\n${tabsList}`,
            base64Images: []
        };
    }
};

/**
 * Switch to a specific tab by index
 */
export const switchTab: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "switchTab",
    description: "Switch to a different browser tab by its index. Use listTabs first to see available tabs.",
    zodParameters: z.object({
        tabIndex: z.number().describe("The index of the tab to switch to (0-based)"),
        reason: z.string().describe("Why you are switching tabs (e.g., 'Switch back to main bank page')"),
    }),
    implementation: async (global, params) => {
        const browser = global.puppeteerBrowser;
        const pages = await browser.pages();
        
        if (params.tabIndex < 0 || params.tabIndex >= pages.length) {
            return {
                text: `Error: Invalid tab index ${params.tabIndex}. There are ${pages.length} tabs (indices 0-${pages.length - 1}).`,
                base64Images: []
            };
        }
        
        const targetPage = pages[params.tabIndex];
        
        try {
            // Bring the page to front
            await targetPage.bringToFront();
            
            // Update the global context
            global.page = targetPage;
            global.pageIndex = params.tabIndex;
            
            const title = await targetPage.title();
            const url = targetPage.url();
            
            return {
                text: `Switched to tab ${params.tabIndex}: "${title}" (${url})`,
                base64Images: []
            };
        } catch (e) {
            return {
                text: `Error switching to tab ${params.tabIndex}: ${e instanceof Error ? e.message : "Unknown error"}`,
                base64Images: []
            };
        }
    }
};

/**
 * Close the current tab (fails if only one tab)
 */
export const closeTab: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "closeTab",
    description: "Close the current browser tab. Cannot close if it's the only tab open. After closing, automatically switches to the previous tab.",
    zodParameters: z.object({
        reason: z.string().describe("Why you are closing this tab (e.g., 'Close unwanted popup tab')"),
    }),
    implementation: async (global, params) => {
        const browser = global.puppeteerBrowser;
        const pages = await browser.pages();
        
        if (pages.length <= 1) {
            return {
                text: "Error: Cannot close the only open tab. There must be at least one tab remaining.",
                base64Images: []
            };
        }
        
        const currentIndex = global.pageIndex;
        const currentPage = global.page;
        
        try {
            // Close the current page
            await currentPage.close();
            
            // Get updated pages list
            const updatedPages = await browser.pages();
            
            // Switch to the previous tab (or the last one if we closed the first tab)
            const newIndex = Math.min(currentIndex, updatedPages.length - 1);
            const newPage = updatedPages[newIndex];
            
            // Bring the new page to front
            await newPage.bringToFront();
            
            // Update global context
            global.page = newPage;
            global.pageIndex = newIndex;
            
            const title = await newPage.title();
            const url = newPage.url();
            
            return {
                text: `Closed tab ${currentIndex}. Now on tab ${newIndex}: "${title}" (${url}). ${updatedPages.length} tab(s) remaining.`,
                base64Images: []
            };
        } catch (e) {
            return {
                text: `Error closing tab: ${e instanceof Error ? e.message : "Unknown error"}`,
                base64Images: []
            };
        }
    }
};
