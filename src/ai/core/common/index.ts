import { HumanMessage } from "@langchain/core/messages";
import { Logger } from "pino";
import { z } from "zod";

type JsonSchema7Type = any;
/**
 * Configuration for LLM providers
 */
export type TLLMProvider = {
    provider: "OpenAI" | "Anthropic" | "Gemini" | "Groq" | "ConfidentialPhalaLLM" | "OpenRouter" | "RedPillLLM",
    temperature: number,
    maxTokens?: number,
    model: string,
}

/**
 * The context of the tool.
 * @see TContext
 * @description This is the context of the tool.
 */

export type TContext = {
    logger: Logger,
    addAsExample: boolean,
    shouldRunFromConfiguredProviders: boolean
    configuredProviders: Record<string, TLLMProvider[]>
}

/**
 * The JSON Schema parameters.
 * @see TJsonSchemaParameters
 * @description This is the JSON Schema parameters.
 */
export type TJsonSchemaParameters = JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: JsonSchema7Type;
    } | undefined;
}

/**
 * The base tool definition.
 * @see TLLMTool
 * @description This is the base tool definition needed to be passed to llms.
 */
export type TLLMTool = {
    type: "function",
    function: {
        name: string,     
        description: string,
        parameters: TJsonSchemaParameters
    }
}

/**
 * The base tool definition that contains common properties.
 * @see TBaseToolDefinition
 * @description This is the base tool definition that contains common properties.
 */
export type TBaseToolDefinition<G, A, S> = {
    name: string,
    description: string,
    /**
     * The implementation of the tool.
     * @param global - The global context.
     * @param args - The arguments of the tool.
     * @param state - The state.
     * @returns The result of the tool.
     */
    implementation: (
        global: G, 
        args: A,
        state: S,
    ) => Promise<string | {
        base64Images: string[],
        text: string,
    }>
    /**
     * The evaluator of the tool.
     * @param global - The global context.
     * @param args - The arguments of the tool.
     * @param toolAnswer - The result of the tool.
     * @returns The result of the evaluator.
     */
    evaluator?: (
        global: G, 
        args: A,
        toolAnswer: string, 
    ) => Promise<HumanMessage | undefined> 
}

/**
 * The definition of the base tool with Zod parameters.
 * @see TZodBaseToolDefinition
 * @description This is the definition of the base tool with Zod parameters.
 */
export type TZodBaseToolDefinition<G, T extends z.ZodType, S> = TBaseToolDefinition<G, z.infer<T>, S> & {
    zodParameters: T,
}

/**
 * The definition of the base tool with JSON Schema parameters.
 * @see TJSONSchemaBaseToolDefinition
 * @description This is the definition of the base tool with JSON Schema parameters.
 */
export type TJSONSchemaBaseToolDefinition<G, S> = TBaseToolDefinition<G, Record<string, unknown>, S> & {
    jsonSchemaParameters: TJsonSchemaParameters,
}

/**
 * The stop definition.
 * @see TStopCheckpoint
 * @description This is the stop definition.
 */
export type TStopCheckpoint<G, T extends z.ZodType> = {
    parameters: T,
    evaluator?: (
        global: G, 
        args: z.infer<T>,
    ) => Promise<string | undefined> 
}

/**
 * The todo definition.
 * @see TToDo
 * @description This is the todo definition.
 */

export type TToDo = {
    isDone: boolean,
    description: string,
}

/**
 * The tool response definition.
 * @see TToolResponse
 * @description This is the tool response definition.
 */
export type TToolResponse<T = unknown> = {
    isSuccess: boolean,
    data: null | T,
    error: {
        message: string
        code: string
        stack?: string
    } | null
}

// TODO : ???
/**
 * The identity of the agent.
 * @see TAgentIdentity
 * @description This is the identity of the agent.
 */
export type TAgentIdentity = {
    name: string,
    expertise: string,
    role: string,
    tools: string,
    guidelines: string,
    context: string,
}

