import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { getBrowserAndPage } from "../utils";
import { z } from "zod";

export const goBack: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "goBack",
    description: "Navigate back to the previous page in browser history. This will try page.goBack() first, and if that fails, it will use the keyboard shortcut Alt+ArrowLeft as a fallback.",
    zodParameters: z.object({}),
    implementation: async (global, args) => {
        const { page } = await getBrowserAndPage(global);
        
        try {
            // First attempt: Use Puppeteer's goBack method
            await page.goBack({
                waitUntil: 'domcontentloaded',
                timeout: 5000,
            });
            
            return { text: JSON.stringify({ 
                message: "Navigated back using page.goBack()" 
            }), base64Images: [] };
        } catch (error) {
            // Fallback: Use keyboard shortcut Alt+ArrowLeft
            try {
                // Press Alt+ArrowLeft to go back (browser back shortcut)
                // Puppeteer requires pressing modifier key, then the key, then releasing modifier
                await page.keyboard.down('Alt');
                await page.keyboard.press('ArrowLeft');
                await page.keyboard.up('Alt');
                
                // Wait a bit for navigation
                await page.waitForNavigation({
                    waitUntil: 'domcontentloaded',
                    timeout: 5000,
                }).catch(() => {});
                
                return { text: JSON.stringify({ 
                    message: "Navigated back using keyboard shortcut Alt+ArrowLeft (fallback)" 
                }), base64Images: [] };
            } catch (fallbackError) {
                return { text: JSON.stringify({ 
                    message: `Failed to navigate back: ${error instanceof Error ? error.message : 'Unknown error'}. Fallback also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}` 
                }), base64Images: [] };
            }
        }
    },
};

