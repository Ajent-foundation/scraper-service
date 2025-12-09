import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { getBrowserAndPage } from "../utils";
import actionImpl from "../../../../browser/interface/impl/index";
import { configureGhostCursor } from "../../../../browser/interface/ghostCursor/index";
import type { GhostCursor } from "ghost-cursor";
import { z } from "zod";

export const scroll: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "scroll",
    description: "Scroll the page. Can scroll to top, bottom, to specific position, or by a certain amount.",
    zodParameters: z.object({
        direction: z.enum(["top", "bottom", "to", "next", "atPosition"]).describe("Scroll direction"),
        x: z.number().optional().describe("X coordinate for 'to' or 'atPosition' scroll"),
        y: z.number().optional().describe("Y coordinate for 'to' or 'atPosition' scroll"),
        scrollX: z.number().optional().describe("Horizontal scroll amount for 'atPosition' scroll"),
        scrollY: z.number().optional().describe("Vertical scroll amount for 'atPosition' scroll"),
    }),
    implementation: async (global, args) => {
        const { page } = await getBrowserAndPage(global);
        
        // Configure cursor if needed (following executeCommands pattern)
        let cursor: GhostCursor | null = null;
        if (global.session.config?.ghostCursor) {
            cursor = await configureGhostCursor(page, global.session.config.cursorConfig);
        }

        // Use existing implementations (following executeCommands pattern)
        switch (args.direction) {
            case "top":
                await actionImpl.scrollTop(page, global.ctx.logger);
                break;
            case "bottom":
                await actionImpl.scrollBottom(page, global.ctx.logger);
                break;
            case "to":
                if (args.y === undefined) throw new Error("Y coordinate required for 'to' scroll");
                await actionImpl.scrollTo(page, { x: 0, y: args.y }, global.ctx.logger);
                break;
            case "next":
                await actionImpl.scrollNext(page, global.ctx.logger);
                break;
            case "atPosition":
                if (args.x === undefined || args.y === undefined || args.scrollY === undefined) {
                    throw new Error("x, y, and scrollY required for 'atPosition' scroll");
                }
                // scrollAtPosition uses factor and axis, not scrollX/scrollY
                // factor: -1 means use container height, otherwise factor * 100
                // axis: 'up' or 'down'
                const factor = args.scrollY > 0 ? Math.ceil(args.scrollY / 100) : Math.floor(args.scrollY / 100);
                const axis = args.scrollY > 0 ? 'down' : 'up';
                await actionImpl.scrollAtPosition(
                    page,
                    cursor!,
                    {
                        x: args.x,
                        y: args.y,
                        factor: factor === 0 ? (args.scrollY > 0 ? 1 : -1) : factor,
                        axis: axis,
                    },
                    global.ctx.logger
                );
                break;
        }

        return { text: JSON.stringify({ 
            message: `Scrolled ${args.direction}` 
        }), base64Images: [] };
    },
};
