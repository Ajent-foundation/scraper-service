import { Logger } from "pino";
import { TAgents } from "./types";
import { TLLMProvider } from "../core/common/index";
import { z } from "zod";

// Agents
import { LLM as GeneralAgent } from "./agents/generalAgent"

export async function init(
    logger: Logger,
    isFake: boolean,
    fakeResponses?: (name: string, groupName: string) => z.infer<any>[],
    usageCallback?: (
        runUUID: string,
        keyOwnerShip: "user" | "system",
        partOfBatchCall: boolean,
        provider: TLLMProvider,
        invoker: Record<string, unknown>,
        inputTokens: number,
        outputTokens: number,
        totalCharCount: number,
        approximatedTextTokens: number,
        numberOfImages: number,
        totalImageSize: number,
        durationMs: number,
    ) => Promise<void>
): Promise<TAgents | undefined> {
    logger.info("Initializing Orchestrator Graph Agents")


    // retrying 5 times
    let AGENTS: TAgents | undefined
    for(let i = 0; i < 5; i++) {
        try {
            await Promise.all([
                GeneralAgent.initFromCachedFile("8fe989b8", logger, isFake, fakeResponses, usageCallback),
            ]);

            AGENTS = {
                generalAgent: GeneralAgent,
            }
            break;
        } catch (error) {
            logger.warn({
                errType: "TASK_AGENTS_INIT_ERROR",
                stack: error instanceof Error ? error.stack : undefined,
                message: error instanceof Error ? error.message : "Unknown error",
            }, "FAILED_TO_INIT_AGENTS")
            // Delay for 10 seconds
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    return AGENTS
}