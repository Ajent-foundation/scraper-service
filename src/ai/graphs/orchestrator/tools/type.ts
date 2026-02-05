import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { getBrowserAndPage } from "../utils";
import actionImpl from "../../../../browser/interface/impl/index";
import { configureGhostCursor } from "../../../../browser/interface/ghostCursor/index";
import type { GhostCursor } from "ghost-cursor";
import { z } from "zod";

export const type: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "type",
    description: `Type text at specific coordinates. Use this to fill in input fields, search boxes, or any text inputs.

CRITICAL: For sensitive values like usernames, passwords, or credentials:
- Check the "AVAILABLE ENVIRONMENT VARIABLES" section in the context
- You MUST use one of the $variableName placeholders listed there (e.g., $username, $password, $userid, $passkey, etc.)
- NEVER guess, infer, or type actual password/credential values
- The system will automatically replace $variableName with the actual masked value
- Match the appropriate placeholder to the form field type`,
    zodParameters: z.object({
        x: z.number().describe("X coordinate of the input field"),
        y: z.number().describe("Y coordinate of the input field"),
        text: z.string().describe("The text to type. For sensitive values (credentials), you MUST use a $variableName placeholder from the AVAILABLE ENVIRONMENT VARIABLES in the context. NEVER type actual password values."),
        reason: z.string().describe("Why you are typing this text (e.g., 'Enter username into login field')"),
    }),
    implementation: async (global, args) => {
        const { page } = await getBrowserAndPage(global);
        
        // Configure cursor if needed (following executeCommands pattern)
        let cursor: GhostCursor | null = null;
        if (global.session.config?.ghostCursor) {
            cursor = await configureGhostCursor(page, global.session.config.cursorConfig);
        }

        // if text starts with $ and in global.envVariables, replace with the value
        if (args.text.startsWith('$') && global.envVariables?.[args.text.slice(1)]) {
            args.text = global.envVariables[args.text.slice(1)];
        }

        // Use existing implementation (handles input clearing, special keys, etc.)
        await actionImpl.typeInput(
            page,
            cursor!,
            {
                x: args.x,
                y: args.y,
                input: args.text,
            }
        );

        return { text: JSON.stringify({ 
            message: `Typed at (${args.x},${args.y})` 
        }), base64Images: [] };
    },
};
