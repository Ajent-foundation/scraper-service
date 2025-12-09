import { TZodBaseToolDefinition } from "../../../core/common/index.js";
import { TBrowserContext } from "../types.js";
import { z } from "zod";

export const think: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "think",
    description: "Think through a problem or plan your next steps. Use this to reason about complex tasks, break down problems, or plan your approach before taking action. This tool helps you organize your thoughts and create a clear plan.",
    zodParameters: z.object({
        reasoning: z.string().describe("Your reasoning, thoughts, or plan. Explain what you're thinking about, what you've considered, and what your plan is."),
    }),
    implementation: async (global, args) => {
        // Think tool just returns the reasoning - it's for the agent to organize thoughts
        return {
            text: JSON.stringify({
                message: "Thinking completed",
                reasoning: args.reasoning,
            }),
            base64Images: [],
        };
    },
};

