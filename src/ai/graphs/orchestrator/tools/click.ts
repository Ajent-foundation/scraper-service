import { z } from "zod";
import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { getBrowserAndPage } from "../utils";
import actionImpl from "../../../../browser/interface/impl/index";
import { configureGhostCursor } from "../../../../browser/interface/ghostCursor/index";
import type { GhostCursor } from "ghost-cursor";

export const click: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "click",
    description: "Click at specific coordinates on the page. Use this to interact with buttons, links, or any clickable elements.",
    zodParameters: z.object({
        x: z.number().describe("X coordinate to click"),
        y: z.number().describe("Y coordinate to click"),
        clickCount: z.number().optional().default(1).describe("Number of clicks (1 for single click, 2 for double click)"),
        button: z.enum(["left", "right", "middle"]).optional().default("left").describe("Mouse button to use"),
        reason: z.string().describe("Why you are clicking this element (e.g., 'Click login button to submit credentials')"),
    }),
    implementation: async (global, args) => {
        const { page } = await getBrowserAndPage(global);
        
        // Configure cursor if needed (following executeCommands pattern)
        let cursor: GhostCursor | null = null;
        if (global.session.config?.ghostCursor) {
            cursor = await configureGhostCursor(page, global.session.config.cursorConfig);
        }

        // Use existing implementation (handles cursor, error handling, etc.)
        // Ensure clickCount defaults to 1 if not provided
        const clickCount = args.clickCount ?? 1;
        await actionImpl.click(
            page,
            cursor!,
            {
                x: args.x,
                y: args.y,
                clickCount: clickCount,
                button: args.button || 'left',
            }
        );

        // Wait a bit for any navigation or page changes
        try {
            await page.waitForNavigation({
                waitUntil: 'domcontentloaded',
                timeout: 3000,
            }).catch(() => {});
        } catch {}

        return { text: JSON.stringify({ 
            message: `Clicked at (${args.x},${args.y})` 
        }), base64Images: [] };
    },
};
