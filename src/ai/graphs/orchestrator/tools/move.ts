import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { getBrowserAndPage } from "../utils";
import actionImpl from "../../../../browser/interface/impl/index";
import { configureGhostCursor } from "../../../../browser/interface/ghostCursor/index";
import type { GhostCursor } from "ghost-cursor";
import { z } from "zod";

export const move: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "move",
    description: "Move the mouse to specific coordinates. Useful for triggering hover effects or tooltips.",
    zodParameters: z.object({
        x: z.number().describe("X coordinate to move to"),
        y: z.number().describe("Y coordinate to move to"),
        reason: z.string().describe("Why you are moving the mouse (e.g., 'Hover over menu to reveal dropdown')"),
    }),
    implementation: async (global, args) => {
        const { page } = await getBrowserAndPage(global);
        
        // Configure cursor if needed (following executeCommands pattern)
        let cursor: GhostCursor | null = null;
        if (global.session.config?.ghostCursor) {
            cursor = await configureGhostCursor(page, global.session.config.cursorConfig);
        }

        // Use existing hover implementation (handles cursor movement properly)
        await actionImpl.hover(
            page,
            cursor!,
            {
                x: args.x,
                y: args.y,
            }
        );

        return { text: JSON.stringify({ 
            message: `Moved to (${args.x},${args.y})` 
        }), base64Images: [] };
    },
};
