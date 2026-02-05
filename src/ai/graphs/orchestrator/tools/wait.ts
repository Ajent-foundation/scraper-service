import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import actionImpl from "../../../../browser/interface/impl/index";
import { z } from "zod";

export const wait: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "wait",
    description: "Wait for a specified amount of time. Useful for waiting for page loads, animations, or dynamic content.",
    zodParameters: z.object({
        milliseconds: z.number().describe("Number of milliseconds to wait"),
        reason: z.string().describe("Why you are waiting (e.g., 'Wait for page to load after clicking')"),
    }),
    implementation: async (global, args) => {
        // Use existing delay implementation (following executeCommands pattern)
        await (actionImpl.delay as any)({
            delay: args.milliseconds,
        });

        return { text: JSON.stringify({ message: `Waited ${args.milliseconds}ms` }), base64Images: [] };
    },
};
