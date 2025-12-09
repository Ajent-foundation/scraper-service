import { AIMessage } from "@langchain/core/messages";
import { LLMWrapper } from '../../core/LLMWrapper/index';
import { z } from "zod";

const PROMPT_NAME = "general-agent"

export const AgentModelInput = z.object({
    expertise: z.string().describe("The expertise of the agent"),
    role: z.string().describe("The role of the agent"),
    objective: z.string().describe("The objective of the agent"),
    tools: z.string().describe("A guide of the tools that the agent can use"),
    guidelines: z.string().describe("General guidelines the agent should follow"),
    context: z.string().describe("Any context that the agent should know about"),
    messages: z.array(z.any()).describe("The conversation history between the agent and the user"),
})

export const AgentModelOutput = z.instanceof(AIMessage)

export const LLM = new LLMWrapper<typeof AgentModelInput, typeof AgentModelOutput>(
    PROMPT_NAME, 
    "general-agent",
    [
        {
            provider: "OpenAI",
            model: "gpt-5-2025-08-07",
            temperature: 1.0,
        },
        {
            provider: "OpenAI",
            model: "gpt-4.1-2025-04-14",
            temperature: 1.0,
        },
    ],
    AgentModelInput, 
    AgentModelOutput, 
    "slow"
)

export type TGeneralAgent = typeof LLM