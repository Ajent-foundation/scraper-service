import { z } from "zod";
import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { getBrowserAndPage } from "../utils";

export const pressEnter: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "pressEnter",
    description: "Press the Enter key. Useful for submitting forms when the submit button is hard to click.",
    zodParameters: z.object({
        reason: z.string().describe("Why you are pressing Enter (e.g., 'Submit the OTP code')"),
    }),
    implementation: async (global, args) => {
        const { page } = await getBrowserAndPage(global);
        
        await page.keyboard.press('Enter');

        // Wait a bit for any navigation or page changes
        try {
            await page.waitForNavigation({
                waitUntil: 'domcontentloaded',
                timeout: 3000,
            }).catch(() => {});
        } catch {}

        return { text: JSON.stringify({ 
            message: "Pressed Enter key" 
        }), base64Images: [] };
    },
};

export const pressEscape: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "pressEscape",
    description: "Press the Escape key. Useful for closing popups, modals, or dialogs.",
    zodParameters: z.object({
        reason: z.string().describe("Why you are pressing Escape (e.g., 'Close the popup dialog')"),
    }),
    implementation: async (global, args) => {
        const { page } = await getBrowserAndPage(global);
        
        await page.keyboard.press('Escape');

        // Short wait for any UI changes
        await new Promise(resolve => setTimeout(resolve, 500));

        return { text: JSON.stringify({ 
            message: "Pressed Escape key" 
        }), base64Images: [] };
    },
};
