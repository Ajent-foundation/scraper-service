import * as hub from "langchain/hub";
import { ChatPromptTemplate, StructuredPrompt } from "@langchain/core/prompts";
import { BaseChatModel, BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models"
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { ChatOpenAI, ChatOpenAICallOptions } from "@langchain/openai"
import { ChatAnthropic, ChatAnthropicCallOptions } from "@langchain/anthropic"
import { ChatGoogleGenerativeAI, GoogleGenerativeAIChatCallOptions } from "@langchain/google-genai"
import { ChatGroq, ChatGroqCallOptions } from "@langchain/groq"
import { RunnableConfig, RunnableSequence } from "@langchain/core/runnables";
import { AIMessage, AIMessageChunk, BaseMessage } from "@langchain/core/messages";
import { load } from "@langchain/core/load";
import { Client, Dataset } from "langsmith";
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";
import { tool } from "@langchain/core/tools"
import { createHash, randomUUID } from "crypto";
import { Logger } from "pino"
import path from "path";
import { z } from "zod"
import fs from "fs"
import { TLLMProvider, TLLMTool } from "../common/index.js";
/**
 * Enterprise-grade LLM wrapper that provides:
 * - Multi-provider abstraction (OpenAI, Anthropic, Gemini, Groq, XAI)
 * - Automatic fallback between providers
 * - Usage tracking and billing
 * - Streaming support
 * - Tool integration
 * - LangSmith prompt management
 * - Automatic dataset collection
 * - Type-safe input/output via Zod schemas
 * 
 * @template I - Input schema type (Zod schema)
 * @template O - Output schema type (Zod schema)
 */
export class LLMWrapper<I extends z.ZodType, O extends z.ZodType> {
    // Configuration constants
    private static readonly RUNNABLE_AGENT_NAME: string = "llmAgent"
    private static readonly TOKEN_RATE: number = 4 // Rough tokens per character estimate
    private static readonly MAX_LANGSMITH_ATTEMPTS = 3
    private static readonly RETRY_DELAY_BASE_MS = 1000
    private static readonly MAX_RETRIES = 3
    
    // Fake response timing configuration for testing
    private static readonly EXAMPLES_LIMIT = 100
    private static readonly FAKE_SPEED_SLOW_MIN_MS = 5000
    private static readonly FAKE_SPEED_SLOW_MAX_MS = 30000
    private static readonly FAKE_SPEED_FAST_MIN_MS = 1000
    private static readonly FAKE_SPEED_FAST_MAX_MS = 5000
    
    // Core configuration
    private _name: string // Used for LangSmith prompt lookup and dataset naming
    private _groupName: string // Logical grouping for organization and tagging
    private _commit: string // Git commit or version for tracking
    private _isInitialized: boolean // Prevents usage before proper initialization
    private _isCacheMode: boolean // Whether to cache the prompt
    private _atCommit: string // The commit at which the prompt was cached
    
    // Schema validation
    private _inputSchema: I // Zod schema for runtime input validation
    private _outputSchema: O // Zod schema for runtime output validation
    
    // Runtime dependencies
    private _logger: Logger | undefined // Structured logging for observability
    private _prompt: StructuredPrompt<any, any> | ChatPromptTemplate<any> | undefined // LangSmith prompt
    
    // Testing configuration
    private _isFake: boolean // Enables fake responses for testing
    private _fakeResponses?: (name: string, groupName: string) => z.infer<O>[] // Test data generator
    private _fakeSpeed: "slow" | "fast" // Simulates different response times
    
    // Provider configuration
    private _providers: TLLMProvider[] // List of providers for fallback
    private _customProvider: TLLMProvider | undefined // Custom provider for the prompt

    /**
     * Usage tracking callback - fires asynchronously after successful LLM calls
     * Used for billing, analytics, and monitoring
     * Fire-and-forget pattern - failures don't affect main LLM response
     */
    private _usageCallback?: (
        runUUID: string,
        keyOwnerShip: "user" | "system", // Whether user provided API key or system key used
        partOfBatchCall: boolean, // True if this call is part of a batch operation
        provider: TLLMProvider,
        invoker: Record<string, unknown>,
        inputTokens: number,
        outputTokens: number,
        totalCharCount: number,
        approximatedTextTokens: number,
        numberOfImages: number,
        totalImageSize: number,
        durationMs: number, // Time for successful attempt only (excludes failed fallbacks)
    ) => Promise<void>

    /**
     * Creates a new LLM wrapper instance
     * 
     * @param name - Unique identifier for LangSmith prompt lookup
     * @param groupName - Logical grouping for organization
     * @param providers - Array of LLM providers to use (with fallback order)
     * @param inputSchema - Zod schema for input validation
     * @param outputSchema - Zod schema for output validation
     * @param isFake - Enable fake responses for testing (default: false)
     * @param fakeSpeed - Simulate response timing for testing (default: "slow")
     * @param fakeResponses - Generator function for test responses (required if isFake=true)
     */
    constructor(
        name: string,
        groupName: string,
        providers: TLLMProvider[],
        inputSchema: I,
        outputSchema: O,
        fakeSpeed: "slow" | "fast" = "slow",
    ){
        this._name = name
        this._groupName = groupName
        this._commit = ""
        this._isInitialized = false
        this._inputSchema = inputSchema
        this._outputSchema = outputSchema
        this._logger = undefined
        this._prompt = undefined
        this._isFake = false
        this._fakeSpeed = fakeSpeed
        this._providers = providers
        this._isCacheMode = false
        this._atCommit = ""
    }

    /** Get the wrapper name (used for LangSmith prompt lookup) */
    get name(): string {
        return this._name
    }

    /** Get the current commit/version */
    get commit(): string {
        return this._commit
    }

    /** Get the loaded LangSmith prompt (throws if not initialized) */
    get prompt(): StructuredPrompt<any, any> | ChatPromptTemplate<any> {
        if(!this._prompt){
            throw new Error("PROMPT_NOT_INITIALIZED")
        }

        return this._prompt
    }

    /** Get the initialized state of the wrapper */
    get isInitialized(): boolean {
        return this._isInitialized
    }

    /**
     * Creates a structured output model based on provider capabilities
     * OpenAI uses tool-based structured output (responseFormatter tool)
     * Other providers use native withStructuredOutput
     * 
     * @param model - The chat model to configure
     * @returns Configured model with structured output
     */
    private _getStructuredOutputModel(
        model: BaseChatModel,
    ) {
        if(model instanceof ChatOpenAI){
            // OpenAI structured output via tool calling
            const responseFormatterTool = tool(async () => {}, {
                name: "responseFormatter",
                schema: this._outputSchema,
            })
            return model.bindTools([responseFormatterTool], {
                tool_choice: "required",
                // if not part of 04 family, set to false
                ...(model.model.includes("o4-") || model.model.includes("o3-") ? {} : {
                    parallel_tool_calls: false,
                }),
            })
        } else {
            // Native structured output for other providers
            return model.withStructuredOutput(this._outputSchema)
        }
    }

    /**
     * Records usage metrics asynchronously (fire-and-forget)
     * Used for billing, analytics, and monitoring
     * Failures in usage recording don't affect the main LLM response
     */
    private async _recordUsage(
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
    ){
        if(this._usageCallback){
            await this._usageCallback(
                runUUID,
                keyOwnerShip,
                partOfBatchCall,
                provider,
                invoker, 
                inputTokens, 
                outputTokens, 
                totalCharCount, 
                approximatedTextTokens, 
                numberOfImages, 
                totalImageSize,
                durationMs
            )
        }
    }

    /**
     * Initializes chat model instances for all configured providers
     * Handles provider-specific configuration and API key resolution
     * 
     * @param providers - Array of provider configurations
     * @param overrides - Additional options to pass to chat models
     * @param apiKey - Optional API key override (falls back to environment variables)
     * @returns Array of initialized chat models
     */
    private _initChatModels(
        providers: TLLMProvider[],
        overrides: BaseChatModelCallOptions,
        apiKey?: string,
        shouldUseFallbackProviders: boolean = true
    ): BaseChatModel[] {
        if(providers.length === 1 && shouldUseFallbackProviders) {
            const backupProviders: TLLMProvider[] = [
                {
                    provider: "OpenAI",
                    model: "gpt-4.1-2025-04-14",
                    temperature: 1
                },
                {
                    provider: "Anthropic",
                    model: "claude-sonnet-4-20250514",
                    temperature: 1
                },
                {
                    provider: "Gemini",
                    model: "gemini-2.0-flash",
                    temperature: 1
                },
            ]

            // Get the primary provider (at index 0) to move it to the end of fallbacks
            const primaryProvider = providers[0]?.provider;
            
            // Sort backup providers so the primary provider type comes last (if we have a primary provider)
            const sortedBackupProviders = primaryProvider 
                ? backupProviders.sort((a, b) => {
                    if (a.provider === primaryProvider) return 1; // Move primary to end
                    if (b.provider === primaryProvider) return -1; // Move primary to end
                    return 0; // Keep other providers in original order
                  })
                : backupProviders;
            
            // loop over sorted backup providers and add fallback to providers that don't exist in the providers array from backup 
            for(const backupProvider of sortedBackupProviders){
                if(!providers.some((p) => p.provider === backupProvider.provider)){
                    providers.push(backupProvider)
                }
            }
        }

        // Ultimate fallback provider
        if(providers[0]){
            // Ultimate fallback provider
            //providers.push(!providers[0].model.includes("claude-sonnet-4") ? {
            //    provider: "OpenRouter",
            //    model: "qwen/qwen3-235b-a22b:free",
            //    temperature: 0.5
            //} : {
            //    provider: "OpenRouter",
            //    model: "qwen/qwen3-coder:free",
            //    temperature: 0.5
            //})

            // push anthropic / gemini as fallback
            providers.push({
                provider: "Anthropic",
                model: "claude-sonnet-4-20250514",
                temperature: 1
            }, {
                provider: "Gemini",
                model: "gemini-2.0-flash",
                temperature: 1
            })
        }

        return providers.map((provider) => {
            if(provider.provider === "OpenAI"){
                const baseConfig: any = {
                    model: provider.model,
                    temperature: provider.temperature,
                    openAIApiKey: apiKey || process.env['OPENAI_API_KEY'],
                    ...overrides,
                }
                // For gpt-5 models requiring max_completion_tokens
                if (provider.model.startsWith("gpt-5")) {
                    // gpt-5 models only support default temperature (1), not custom values
                    baseConfig.temperature = 1
                    
                    if (provider.maxTokens !== undefined) {
                        baseConfig.maxCompletionTokens = provider.maxTokens
                    }

                    // TODO - hardcoded for now
                    baseConfig.reasoning = {
                        effort: "low"
                    }
                } else {
                    if (provider.maxTokens !== undefined) {
                        baseConfig.maxTokens = provider.maxTokens
                    }
                }
                return new ChatOpenAI({...baseConfig})
            } else if(provider.provider === "Anthropic"){
                return new ChatAnthropic({
                    model: provider.model,
                    temperature: provider.temperature,
                    maxTokens: provider.maxTokens,
                    anthropicApiKey: apiKey || process.env['ANTHROPIC_API_KEY'],
                    ...overrides,
                })
            } else if(provider.provider === "Gemini"){
                return new ChatGoogleGenerativeAI({
                    model: provider.model,
                    temperature: provider.temperature,
                    apiKey: apiKey || process.env['GOOGLE_API_KEY'],
                    ...overrides,
                })
            } else if(provider.provider === "Groq"){
                return new ChatGroq({
                    model: provider.model,
                    temperature: provider.temperature,
                    maxTokens: provider.maxTokens,
                    apiKey: apiKey || process.env['GROQ_API_KEY'],
                    ...overrides,
                })
            } else if(provider.provider === "OpenRouter"){
                // This is another openai compatible provider
                return new ChatOpenAI({
                    model: provider.model,
                    temperature: provider.temperature,
                    maxTokens: provider.maxTokens,
                    openAIApiKey: apiKey || process.env['OPEN_ROUTER_API_KEY'],
                    apiKey: apiKey || process.env['OPEN_ROUTER_API_KEY'],
                    streaming: true,
                    configuration: {
                        baseURL: 'https://openrouter.ai/api/v1',
                        defaultHeaders: {
                            "HTTP-Referer": "https://playground.tasker.ai/",
                            "X-Title": "Tasker AI",
                        }
                    },
                    ...overrides,
                })
            } else if(provider.provider === "ConfidentialPhalaLLM"){
                return new ChatOpenAI({
                    model: provider.model,
                    temperature: provider.temperature,
                    maxTokens: provider.maxTokens,
                    openAIApiKey: apiKey || process.env['CONFIDENTIAL_PHALA_LLM_API_KEY'],
                    apiKey: apiKey || process.env['CONFIDENTIAL_PHALA_LLM_API_KEY'],
                    streaming: true,
                    configuration: {
                        baseURL: 'https://api.redpill.ai/v1',
                    },
                    ...overrides,
                })
            }
            
            else {
                throw new Error(`Unsupported provider: ${provider.provider}`)
            }
        })
    }

    /**
     * Generates random response time for fake responses
     * Used to simulate realistic API response times during testing
     * 
     * @returns Random delay in milliseconds
     */
    private _getFakeSpeed(){
        if(this._fakeSpeed === "slow"){
            // Simulate slow API responses (5-30 seconds)
            return Math.floor(Math.random() * (LLMWrapper.FAKE_SPEED_SLOW_MAX_MS - LLMWrapper.FAKE_SPEED_SLOW_MIN_MS + 1)) + LLMWrapper.FAKE_SPEED_SLOW_MIN_MS
        } else {
            // Simulate fast API responses (1-5 seconds)
            return Math.floor(Math.random() * (LLMWrapper.FAKE_SPEED_FAST_MAX_MS - LLMWrapper.FAKE_SPEED_FAST_MIN_MS + 1)) + LLMWrapper.FAKE_SPEED_FAST_MIN_MS
        }
    }

    /**
     * Attaches tools to a chat model for function calling
     * Only used when output schema is AIMessage (tool calls require AIMessage)
     * 
     * @param model - Chat model to attach tools to
     * @param tools - Array of tool wrappers to attach
     * @param toolChoice - How the model should choose tools ("auto" | "any" | "none")
     * @returns Model with tools attached, or original model if no tools
     */
    private __attachTools(
        model: BaseChatModel,
        tools: TLLMTool[],
        toolChoice: "auto" | "any" | "none" | "required" = "auto",
        parallelToolCalls: boolean = false,
    ){
        if(tools.length === 0){
            return model
        }

        if(!model.bindTools){
            throw new Error("MODEL_DOES_NOT_SUPPORT_TOOLS")
        }

        if (model instanceof ChatOpenAI){
            return model.bindTools(tools.map((tool) => tool), {
                tool_choice: toolChoice,
                ...(model.model.includes("o4-") ? {
                } : {
                    parallel_tool_calls: parallelToolCalls,
                }),
            })
        } else if (model instanceof ChatAnthropic) {
            return model.bindTools(tools.map((tool) => tool), {
                tool_choice: "auto",
            })
        } else {
            return model.bindTools(tools.map((tool) => tool), {
                tool_choice: toolChoice,
            })
        }
    }

    /**
     * Extracts structured output from OpenAI's responseFormatter tool call
     * OpenAI structured output works by calling a special "responseFormatter" tool
     * 
     * @param aiMessage - AI message containing tool calls
     * @returns Parsed structured output
     */
    private async __parseResponseFormatter(
        aiMessage: AIMessage,
    ){
        if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0){
            throw new Error("Missing responseFormatter tool call")
        }

        // Find the responseFormatter tool call
        const responseFormatterToolCall = aiMessage.tool_calls.find((toolCall) => toolCall.name === "responseFormatter")
        if(!responseFormatterToolCall){
            throw new Error("Missing responseFormatter tool call")
        }

        // Extract and return the structured arguments
        return responseFormatterToolCall.args as z.infer<O>
    }

    /**
     * Handles LLM invocation with streaming support
     * Processes streaming events and forwards appropriate chunks to the callback
     * Handles both structured output parsing and tool calls
     * 
     * @param runUUID - Unique identifier for this run
     * @param chain - LangChain runnable sequence
     * @param input - Input data
     * @param options - Run options including invoker context
     * @param isOutcomeFromResponseFormatter - Whether to parse OpenAI responseFormatter
     * @param config - LangChain configuration
     * @param signal - Abort signal for cancellation
     * @param onStream - Callback for streaming chunks
     * @returns Final parsed result
     */
    private async __invokeWithStream(
        runUUID: string,
        chain: RunnableSequence<z.infer<I>, z.infer<O>>,
        input: z.infer<I>,
        options: {
            invoker: Record<string, unknown>,
            tags?: string[],
            metadata?: Record<string, unknown>,
        },
        isOutcomeFromResponseFormatter: boolean,
        config: RunnableConfig,
        signal?: AbortSignal,
        onStream?: (chunk: z.infer<O>) => void,
    ){
        let result: z.infer<O> | undefined
        
        // Process streaming events from LangChain
        for await (const streamEvent of chain.withConfig(config).streamEvents(
            input,
            { 
                runId: runUUID,
                runName: `${this._name}-${LLMWrapper.RUNNABLE_AGENT_NAME}`,
                metadata: {
                    ...options.invoker,
                    ...(options.metadata || {}),
                },
                tags: [
                    this._groupName,
                    ...(options.tags || []),
                ],
                version: "v2",
                signal
            }
        )) {
            try {
                if(streamEvent.event === "on_chain_end"){
                    // Final result - parse based on output type
                    if(isOutcomeFromResponseFormatter){
                        const aiMessage = streamEvent.data.output as AIMessage
                        result = await this.__parseResponseFormatter(aiMessage)
                    } else {
                        result = streamEvent.data.output
                    }
                } else if(streamEvent.event === "on_chat_model_stream"){
                    // Raw model streaming chunks (AIMessageChunk)
                    const chunk = streamEvent.data.chunk as AIMessageChunk
                    if(chunk) {
                        onStream?.({...chunk} as z.infer<O>)
                    }
                } else if (streamEvent.event === "on_parser_stream"){
                    // Parsed structured output chunks
                    const chunk = streamEvent.data.chunk as z.infer<O>
                    if(chunk && Object.keys(chunk).length > 0) {
                        onStream?.({...chunk as any})
                    }
                }
            } catch(error){
                // Log streaming errors but continue processing
                this._logger?.error({
                    errorType: "STREAM_ERROR",
                    message: error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                    commit: this._commit,
                }, "CRITICAL_ERROR")
            }
        }

        return result
    }

    /**
     * Handles LLM invocation without streaming
     * Simpler path for non-streaming requests
     * 
     * @param runUUID - Unique identifier for this run
     * @param chain - LangChain runnable sequence
     * @param input - Input data
     * @param options - Run options including invoker context
     * @param isOutcomeFromResponseFormatter - Whether to parse OpenAI responseFormatter
     * @param config - LangChain configuration
     * @param signal - Abort signal for cancellation
     * @returns Final parsed result
     */
    private async __invokeWithoutStream(
        runUUID: string,
        chain: RunnableSequence<z.infer<I>, z.infer<O>>,
        input: z.infer<I>,
        options: {
            invoker: Record<string, unknown>,
            tags?: string[],
            metadata?: Record<string, unknown>,
        },
        isOutcomeFromResponseFormatter: boolean,
        config: RunnableConfig,
        signal?: AbortSignal,
    ){
        let result: z.infer<O> | undefined
        
        // Single invocation without streaming
        const llmResult = await chain.withConfig(config).invoke(
            input,
            { 
                runId: runUUID,
                runName: `${this._name}-${LLMWrapper.RUNNABLE_AGENT_NAME}`,
                metadata: {
                    ...options.invoker,
                    ...(options.metadata || {}),
                },
                tags: [
                    this._groupName,
                    ...(options.tags || []),
                ],
                signal
            }
        )

        // Parse result based on output type
        if(isOutcomeFromResponseFormatter){
            const aiMessage = llmResult as AIMessage
            result = await this.__parseResponseFormatter(aiMessage)
        } else {
            result = llmResult
        }

        return result
    }

    /**
     * Creates a consistent hash of the input for deduplication
     * Used to prevent adding duplicate examples to LangSmith datasets
     * Sorts keys to ensure consistent hashing regardless of object key order
     * 
     * @param input - Input data to hash
     * @returns SHA-256 hex hash of the input
     */
    private __getInputHash(input: z.infer<I>): string {
        // Sort keys to ensure consistent ordering  
        const inputAsRecord = input as Record<string, any>;
        const sortedInput = Object.keys(inputAsRecord)
        .sort()
        .reduce((obj, key) => {
            obj[key] = inputAsRecord[key];
            return obj;
        }, {} as Record<string, unknown>);

        // Convert to string and hash
        const inputString = JSON.stringify(sortedInput);
        return createHash('sha256')
            .update(inputString)
            .digest('hex');
    }

    /**
     * Automatically adds successful input/output pairs to LangSmith datasets
     * Runs asynchronously (fire-and-forget) to not block LLM responses
     * Creates datasets if they don't exist, prevents duplicates, limits to 120 examples
     * 
     * @param runUUID - Unique identifier for this example
     * @param input - Input data
     * @param output - Output data
     */
    private async __addAsExample(
        runUUID: string,
        input: z.infer<I>,
        output: z.infer<O>,
    ){
        try{
            const datasetName = `${this._name}-dataset`
            const client = new Client();
    
            // Generate hash for deduplication
            const inputHash = this.__getInputHash(input);

            // Find existing dataset
            const datasets = client.listDatasets({datasetName});
            let targetDataset: Dataset | null = null
            for await (const dataset of datasets) {
                if(dataset.name === datasetName){
                    targetDataset = dataset
                    break
                }
            }
    
            // Create dataset if it doesn't exist
            if(!targetDataset){
                targetDataset = await client.createDataset(datasetName, {
                    description: "Dataset for " + this._name,
                    dataType: "kv",
                    inputsSchema: z.toJSONSchema(this._inputSchema), 
                    outputsSchema: z.toJSONSchema(this._outputSchema),
                    metadata: {
                        group: this._groupName,
                    }
                })
            }
    
            // Only add examples if under limit
            try {
                if(targetDataset.example_count ? targetDataset.example_count <= LLMWrapper.EXAMPLES_LIMIT : true){
                    const examples = client.listExamples({
                        datasetId: targetDataset.id,
                    });
        
                    // Check for duplicates
                    let exampleAlreadyExists = false
                    for await (const example of examples){
                        const currentExampleInputHash = this.__getInputHash(example.inputs as z.infer<I>);
                        if(currentExampleInputHash === inputHash){
                            exampleAlreadyExists = true
                            break
                        }
                    }

                    if(!exampleAlreadyExists){
                        // Add new example
                        await client.createExample({
                            inputs: input as any, 
                            outputs: output as any,
                            dataset_name: datasetName, 
                            created_at: new Date().toISOString(),
                            metadata: {
                                group: this._groupName,
                            }, 
                            id: runUUID,
                            split: "train"
                    })
                    } else {
                        this._logger?.warn({
                            errorType: "EXAMPLE_ALREADY_EXISTS",
                            message: `Example already exists for ${datasetName}`,
                            datasetId: targetDataset.id,
                            commit: this._commit,
                            name: this._name,
                            group: this._groupName,
                        }, "CRITICAL_WARNING")
                    }
                }
            } catch(error: unknown){
                this._logger?.error({
                    errorType: "FAILED_TO_ADD_EXAMPLE",
                    error: error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                    commit: this._commit,
                    name: this._name,
                }, "CRITICAL_ERROR")
            }
        } catch (error:unknown) {
            // Log but don't throw - data collection is optional
            this._logger?.error({
                errtype: "DATA_COLLECTION_ERROR",
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined,
                commit: this._commit,
                name: this._name,
            }, "CRITICAL_ERROR")
        }
    }

    public async initFromCachedFile(
        commit: string, 
        logger: Logger,
        isFake: boolean,
        fakeResponses?: (name: string, groupName: string) => z.infer<O>[],
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
    ){
        // call admin api to cache prompt on its side
        if(process.env['ADMIN_API_URL']){
            const requestBody = {
                service: process.env["SERVICE_NAME_IDENTIFIER"],
                name: this.name,
                groupName: this._groupName,
                commit: commit,
            }

            // Log request body
            logger.info({
                message: "Caching prompt",
                requestBody: requestBody,
            }, "CACHE_PROMPT_REQUEST")

            // Fire and forget - ignore errors silently
            fetch(`${process.env['ADMIN_API_URL']}/prompts/get`, {
                method: "POST",
                body: JSON.stringify(requestBody),
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env["ADMIN_API_KEY"] || ""
                }
            }).catch((error) => {
                logger.error({
                    errorType: "FAILED_TO_CACHE_PROMPT",
                    error: error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                    commit: commit,
                    name: this.name,
                    service: process.env["SERVICE_NAME_IDENTIFIER"],
                    groupName: this._groupName,
                }, "PROMPT_CACHE_ERROR")
            })
        }

        // if no cached file, then becomes pull from LangSmith
        const cachedFileDirectory = path.join(__dirname, "..", "..", "cachedPrompts")
        const fileName = `${this.name}_${this._groupName}_${commit}.json`
        if(!fs.existsSync(`${cachedFileDirectory}/${fileName}`)){
            return this.initFromLangSmith(commit, logger, isFake, fakeResponses, usageCallback, true)
        }

        // Validate fake responses configuration
        this._isFake = isFake
        this._fakeResponses = fakeResponses
        if(isFake){
            if(!fakeResponses){
                throw new Error("NO_FAKE_RESPONSES_FOUND")
            }
        }

        // Store callback and dependencies
        this._usageCallback = usageCallback

        // Prevent double initialization
        if(this._isInitialized){
            return
        }

        this._logger = logger
        this._isInitialized = true

        // read from file (file name is the name of the agent)
        const prompt = fs.readFileSync(`${cachedFileDirectory}/${fileName}`, "utf8")
        this._prompt = await load(prompt)
        this._isCacheMode = true
        this._atCommit = commit
    }

    /**
     * Initializes the LLM wrapper by loading prompt from LangSmith
     * Must be called before using invoke() method
     * Implements retry logic for reliability
     * 
     * @param commit - Git commit or version identifier for tracking
     * @param logger - Structured logger for observability
     * @param usageCallback - Optional callback for usage tracking and billing
     */
    public async initFromLangSmith(
        commit: string, 
        logger: Logger,
        isFake: boolean,
        fakeResponses?: (name: string, groupName: string) => z.infer<O>[],
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
        ) => Promise<void>,
        shouldCache: boolean = false,
    ){
        // Validate fake responses configuration
        this._isFake = isFake
        this._fakeResponses = fakeResponses
        if(isFake){
            if(!fakeResponses){
                throw new Error("NO_FAKE_RESPONSES_FOUND")
            }
        }

        // Store callback and dependencies
        this._usageCallback = usageCallback

        // Prevent double initialization
        if(this._isInitialized){
            return
        }

        this._logger = logger
        this._isInitialized = true

        // Pull prompt from LangSmith with retry logic
        const MAX_ATTEMPTS = LLMWrapper.MAX_LANGSMITH_ATTEMPTS;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                this._prompt = await hub.pull<StructuredPrompt<any, any>>(this.name);
                logger.info({
                    message: "Pulled prompt from LangSmith",
                    commit: commit,
                    name: this.name,
                    ...this._prompt.metadata,
                }, "INFO")
                if(shouldCache){
                    const cachedFileDirectory = path.join(__dirname, "..", "..", "cachedPrompts")
                    const fileName = `${this.name}_${this._groupName}_${commit}.json`

                    try {
                        // check if a file of old commit that we don't know about its value
                        // look for all files with <name>_<_groupName>_*.json
                        const files = fs.readdirSync(cachedFileDirectory)
                        for(const file of files){
                            if(file.startsWith(`${this.name}_${this._groupName}_`)){
                                // Delete the file
                                fs.unlinkSync(`${cachedFileDirectory}/${file}`)
                            }
                        }
                    } catch(error){}

                    // Write the new prompt to the file
                    fs.writeFileSync(`${cachedFileDirectory}/${fileName}`, JSON.stringify(this._prompt.toJSON()))
                }
                break
            } catch (error) {
                if (attempt === MAX_ATTEMPTS) {
                    logger.error({
                        errorType: "FAILED_TO_PULL_PROMPT_FROM_LANGSMITH",
                        message: `Failed to pull from LangSmith after ${MAX_ATTEMPTS} for ${this.name} attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
                        commit: commit,
                        name: this.name,
                    }, "CRITICAL_ERROR")
                    throw new Error(
                        `Failed to pull from LangSmith after ${MAX_ATTEMPTS} for ${this.name} attempts: ${error instanceof Error ? error.message : "Unknown error"}`
                    );
                }

                // Exponential backoff delay
                await new Promise(resolve => setTimeout(resolve, LLMWrapper.RETRY_DELAY_BASE_MS * attempt));
            }
        }
    }

    /**
     * Initializes the LLM wrapper by loading from a chat prompt template
     * Must be called before using invoke() method
     * Implements retry logic for reliability
     * 
     * @param logger - Structured logger for observability
     * @param usageCallback - Optional callback for usage tracking and billing
     */
    public async initFromChatPromptTemplate(
        chatPromptTemplate: ChatPromptTemplate<any>,
        logger: Logger,
        isFake: boolean,
        fakeResponses?: (name: string, groupName: string) => z.infer<O>[],
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
    ){
        // Validate fake responses configuration
        this._isFake = isFake
        this._fakeResponses = fakeResponses
        if(isFake){
            if(!fakeResponses){
                throw new Error("NO_FAKE_RESPONSES_FOUND")
            }
        }

        // Store callback and dependencies
        this._usageCallback = usageCallback

        // Prevent double initialization
        if(this._isInitialized){
            throw new Error("ALREADY_INITIALIZED")
        }

        this._logger = logger
        this._isInitialized = true

        //this._prompt = chatPromptTemplate
        this._prompt = chatPromptTemplate
    }

    /**
     * Upgrades the prompt to the latest version
     * If the prompt is cached, it will be upgraded to the latest version
     * If the prompt is not cached, it will be upgraded to the latest version
     * 
     */
    private async _upgradePrompt(){
        if(this._isCacheMode && process.env['ADMIN_API_URL']){
            try {
                // I- check with admin api if new commit hash is available (with 5s timeout)
                const shouldUpdateController = new AbortController()
                const shouldUpdateTimeout = setTimeout(() => shouldUpdateController.abort(), 5000)
                
                const shouldUpdateResponse = await fetch(`${process.env['ADMIN_API_URL']}/prompts/shouldUpdate`, {
                    method: "POST",
                    body: JSON.stringify({
                        name: this._name,
                        groupName: this._groupName,
                        service: process.env["SERVICE_NAME_IDENTIFIER"],
                        currentCommit: this._atCommit,
                    }),
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": process.env["ADMIN_API_KEY"] || ""
                    },
                    signal: shouldUpdateController.signal
                })
                clearTimeout(shouldUpdateTimeout)

                // Log response
                this._logger?.info({
                    message: "Should update response",
                    response: shouldUpdateResponse,
                }, "UPGRADE_PROMPT_RESPONSE")

                const data = await shouldUpdateResponse.json()
                if(data.shouldUpdate){
                    // II- pull new prompt from admin api (with 5s timeout)
                    const getCachedPromptController = new AbortController()
                    const getCachedPromptTimeout = setTimeout(() => getCachedPromptController.abort(), 5000)
                    
                    const getCachedPromptResponse = await fetch(`${process.env['ADMIN_API_URL']}/prompts/get`, {
                        method: "POST",
                        body: JSON.stringify({
                            name: this._name,
                            groupName: this._groupName,
                            service: process.env["SERVICE_NAME_IDENTIFIER"],
                            commit: data.latestCommit,
                        }),
                        headers: {
                            "Content-Type": "application/json",
                            "x-api-key": process.env["ADMIN_API_KEY"] || ""
                        },
                        signal: getCachedPromptController.signal
                    })
                    clearTimeout(getCachedPromptTimeout)

                    // we get promptJson as base64 string
                    const getCachedPromptData = await getCachedPromptResponse.json()
                    const promptJson = Buffer.from(getCachedPromptData.promptJson, "base64").toString("utf8")
                    this._prompt = await load(promptJson)
                    this._atCommit = data.latestCommit

                    // Log response
                    this._logger?.info({
                        message: "Got new prompt",
                        response: getCachedPromptData,
                    }, "UPGRADE_PROMPT_SUCCESS")
                }

                // check if we need to update custom model and provider
                if(this._providers.length > 0 && data.customModel && data.customProvider){
                    if(
                        data.customProvider === "OpenAI" || data.customProvider === "Anthropic" || data.customProvider === "Gemini" || data.customProvider === "Groq" ||
                         data.customProvider === "OpenRouter" || data.customProvider === "XAI" || data.customProvider === "Taragon"
                    ){
                        const p =this._providers[0]
                        if(p && data.customModel !== ""){
                            // find index 0 provider and copy its parameters
                            this._customProvider = {
                                ...p,
                                model: data.customModel,
                                provider: data.customProvider,
                            }
                        }
                    }
                } else {
                    this._customProvider = undefined
                }
            } catch (error) {
                this._logger?.error({
                    errorType: "FAILED_TO_UPGRADE_PROMPT",
                    error: error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                    commit: this._atCommit,
                    name: this._name,
                }, "CRITICAL_ERROR")
            }
        }
    }

    /**
     * Main method to invoke the LLM with comprehensive features:
     * - Multi-provider fallback system
     * - Usage tracking and billing
     * - Streaming support
     * - Tool integration
     * - Automatic dataset collection
     * - Type-safe input/output validation
     * 
     * @param input - Input data matching the input schema
     * @param toolsConfig - Configuration for tool calling
     * @param options - Invocation options including context and flags
     * @param overrides - Optional overrides for LLM parameters
     * @param onStream - Optional callback for streaming responses
     * @param apiKey - Optional API key override
     * @param signal - Optional abort signal for cancellation
     * @returns Promise resolving to structured output
     */
    public async invoke(
        input: z.infer<I>,
        configuredProviders: TLLMProvider[],
        toolsConfig: {
            tools: TLLMTool[],
            toolChoice: "auto" | "any" | "none" | "required",
            parallel_tool_calls?: boolean,
            tracerName?: string,
        },
        options: {
            invoker: Record<string, unknown>, // Context for tracking and billing
            shouldRunFromConfiguredProviders: boolean, // Whether to run from configured providers
            addAsExample: boolean, // Whether to add to training dataset
            tags?: string[], // Additional tags for observability
            metadata?: Record<string, unknown>, // Additional metadata
            allowRetries?: boolean,
            throwErrorIfEmptyResponse?: boolean,
        },
        overrides: BaseChatModelCallOptions | ChatOpenAICallOptions | ChatAnthropicCallOptions | GoogleGenerativeAIChatCallOptions | ChatGroqCallOptions = {},
        onStream?: (chunk: z.infer<O>) => void,
        apiKey?: string,
        signal?: AbortSignal,
        overrideProviders?: TLLMProvider[],
    ): Promise<z.infer<O>> {
        // Ensure initialization
        if (!this._isInitialized) {
            throw new Error("NOT_INITIALIZED")
        }
        
        // should upgrade prompt or not
        await this._upgradePrompt()

        // Generate unique run identifier
        const runUUID = randomUUID()

        const { throwErrorIfEmptyResponse = false } = options
        
        // Initialize chat models for all providers
        const setProviders = options.shouldRunFromConfiguredProviders && configuredProviders.length > 0 ? configuredProviders : (overrideProviders || (this._customProvider ? [this._customProvider, ...this._providers] : this._providers))
        const chatModels = this._initChatModels(setProviders, overrides, apiKey, !options.shouldRunFromConfiguredProviders)
        if(chatModels.length === 0) {
            throw new Error("NO_CHAT_MODELS_FOUND")
        }

        if(!this._prompt){
            throw new Error("PROMPT_NOT_INITIALIZED")
        }

        // Check if output schema is AIMessage (required for tools)
        let isAiMessageOutputSchema: boolean = false
        try {
            const aiTestMessage = new AIMessage({
                content: "Hello, how are you?"
            })
            this._outputSchema.parse(aiTestMessage)
            isAiMessageOutputSchema = true
        } catch(error){
            if(toolsConfig.tools.length > 0){
                this._logger?.warn({
                    errorType: "INVALID_LLM_OUTPUT_SCHEMA",
                    message: error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                }, "CRITICAL_WARNING")
            }
        }

        // Validate tool compatibility
        if(toolsConfig.tools.length > 0 && !isAiMessageOutputSchema){
            throw new Error("OUTPUT_SCHEMA_MUST_BE_AIMessage")
        }

        // Process images for usage tracking and billing
        let images: {size: number}[] = []
        const inputAsRecord = input as Record<string, any>;
        for (const property of Object.keys(inputAsRecord)){
            const propertyValue = inputAsRecord[property]
            if(Array.isArray(propertyValue)) {
                for (const message of propertyValue) {
                    // Images are embedded in BaseMessage content
                    if (!(message instanceof BaseMessage)) {
                        break
                    }

                    if (!Array.isArray(message.content)) {
                        continue
                    }

                    // Scan for image content
                    for (const content of message.content) {
                        // TODO - investigate if this is correct
                        if (content.type === "image" && typeof content.url === "string") {
                            // Calculate base64 image size for billing
                            let size = -1
                            if(content.url.startsWith("data:image")){
                                const base64 = content.url.split(",")[1]
                                const image = Buffer.from(base64, "base64")
                                size = image.length
                            } 

                            images.push({
                                size
                            })
                        }
                    }
                }
            }
        }

        // Validate input against schema (non-blocking warning)
        const parsedResult = this._inputSchema.safeParse(input)
        if(!parsedResult.success){
            this._logger?.warn({
                errorType: "INVALID_LLM_INPUT",
                message: parsedResult.error.message,
                input: input,
                details: parsedResult.error.issues.map((issue) => issue.message),
            }, "CRITICAL_WARNING")
        }

        // Validate fake configuration
        if(this._isFake && !this._fakeResponses){
            throw new Error("NO_FAKE_RESPONSES_FOUND")
        }

        // Fallback mechanism - try each provider until one succeeds
        let index = 0
        let initialError: unknown | undefined
        for (const model of [
            // Inject fake responses if testing
            ...(this._isFake ? [
                new FakeListChatModel({
                    responses: (this._fakeResponses?.(this._name, this._groupName))?.map((response) => JSON.stringify(response)) || [],
                    sleep: this._getFakeSpeed(),
                })
            ] : []), 
            ...chatModels
        ]) {
            let isTimeout: boolean = false
            let totalTextCharCount: number = 0
            let totalTextTokens: number = 0
            let startTime: number = Date.now() // Reset timer for each provider attempt
            
            // Retry logic wrapper
            const maxAttempts = options.allowRetries ? LLMWrapper.MAX_RETRIES + 1 : 1
            let lastError: unknown | undefined
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    // If aborted exit
                    if(signal?.aborted){
                        throw new Error("LLM_ABORTED")
                    }

                    // Add delay for retries (exponential backoff)
                    if (attempt > 0 && options.allowRetries) {
                        const delayMs = LLMWrapper.RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1)
                        this._logger?.info({
                            message: `Retrying LLM invocation, attempt ${attempt + 1}/${maxAttempts}`,
                            delayMs,
                            provider: setProviders[index]?.model || "unknown",
                            commit: this._commit,
                            name: this._name,
                        }, "LLM_RETRY_ATTEMPT")
                        
                        await new Promise(resolve => setTimeout(resolve, delayMs))
                        startTime = Date.now() // Reset timer for retry attempt
                    }

                    let tracer: LangChainTracer | undefined = undefined
                    if(toolsConfig.tracerName){
                        tracer = new LangChainTracer({ projectName: toolsConfig.tracerName});
                    }

                    // Configure LangChain execution
                    const config: RunnableConfig = {
                        runName: this._name,
                        metadata: {
                            ...options.invoker,
                            ...(options.metadata || {}),
                        },
                        tags: [
                            this._groupName,
                            ...(options.tags || []),
                        ],
                        callbacks: [
                            ...(tracer ? [tracer] : []),
                            {
                                // Track token usage when LLM starts
                                handleLLMStart(_, prompts) {
                                    let totalTokens = 0
                                    let charCount = 0
                                    for (const prompt of prompts){
                                        for (const line of prompt.split("\n")){
                                            const tokens = line.length / LLMWrapper.TOKEN_RATE
                                            totalTokens += tokens
                                            charCount += line.length
                                        }
                                    }

                                    totalTextTokens = totalTokens
                                    totalTextCharCount = charCount
                                },
                                
                                // Record usage when LLM completes (fire-and-forget)
                                handleLLMEnd: async (output) => {
                                    // Skip fake responses
                                    if(this._isFake){
                                        return
                                    }

                                    if(!output.llmOutput || !output.llmOutput["tokenUsage"]){
                                        this._logger?.warn({
                                            errorType: "LLM_OUTPUT_NOT_FOUND",
                                            message: "LLM output not found",
                                            commit: this._commit,
                                            model: model._modelType(),
                                            name: model.name || "Unknown",
                                        }, "MISSING_LLM_OUTPUT")
                                    } else {
                                        const inputTokens = output.llmOutput["tokenUsage"]["promptTokens"]
                                        const outputTokens = output.llmOutput["tokenUsage"]["completionTokens"]

                                        const provider = setProviders[index]
                                        if(!provider){
                                            this._logger?.error({
                                                errorType: "LLM_PROVIDER_NOT_FOUND",
                                                message: "LLM provider not found",
                                                commit: this._commit,
                                                model: model._modelType(),
                                                name: model.name || "Unknown",
                                            }, "CRITICAL_ERROR")
                                            return
                                        }

                                        // Fire-and-forget usage recording
                                        this._recordUsage(
                                            runUUID,
                                            apiKey ? "user" : "system",
                                            false,
                                            provider,
                                            options.invoker,
                                            inputTokens, 
                                            outputTokens, 
                                            totalTextCharCount, 
                                            totalTextTokens, 
                                            images.length, 
                                            images.reduce((acc, image) => acc + (image.size > 0 ? image.size : 0), 0),
                                            Date.now() - startTime
                                        )
                                    }
                                },
                            }
                        ]
                    }

                    // Configure model based on tool usage
                    const llmModel = isAiMessageOutputSchema ? 
                        this.__attachTools(model, toolsConfig.tools, toolsConfig.toolChoice, toolsConfig.parallel_tool_calls) 
                        : 
                        this._getStructuredOutputModel(model)

                    // Determine if we need to parse OpenAI responseFormatter
                    let isOutcomeFromResponseFormatter: boolean = true
                    if (!(model instanceof ChatOpenAI) || isAiMessageOutputSchema){
                        isOutcomeFromResponseFormatter = false
                    }

                    // Create execution chain
                    const chain = RunnableSequence.from([
                        this._prompt, 
                        llmModel,
                    ]);
                    
                    // Handle timeout with Promise.race
                    if (overrides.timeout) {
                        const controller = new AbortController()
                        let timeoutHandle: NodeJS.Timeout | undefined;
                        const timeoutPromise = new Promise<never>((_, reject) => {
                            timeoutHandle = setTimeout(() => {
                                controller.abort()
                                isTimeout = true
                                reject(new Error(`LLM_TIMEOUT_AFTER_${overrides.timeout}ms`))
                            }, overrides.timeout)
                        })

                        const mainPromise = onStream ? this.__invokeWithStream(
                            runUUID,
                            chain as RunnableSequence<any, any>,
                            input,
                            options,
                            isOutcomeFromResponseFormatter,
                            config,
                            controller.signal,
                            onStream
                        ) : this.__invokeWithoutStream(
                            runUUID,
                            chain as RunnableSequence<any, any>,
                            input,
                            options,
                            isOutcomeFromResponseFormatter,
                            config,
                            controller.signal
                        )

                        const result = await Promise.race([mainPromise, timeoutPromise])
                        
                        // Clean up the timeout to prevent unhandled rejection
                        if (timeoutHandle) {
                            clearTimeout(timeoutHandle)
                        }
                        
                        if(!result){
                            throw new Error("NO_RESULT_FOUND")
                        }

                        if(((result as any) instanceof AIMessage || (result as any) instanceof AIMessageChunk) && (typeof (result as any).content === "string" && (result as any).content.length === 0) && toolsConfig.tools.length === 0){
                            if(throwErrorIfEmptyResponse){
                                throw new Error("EMPTY_RESPONSE")
                            }
                        }

                        // Optionally add to training dataset (fire-and-forget)
                        if(options.addAsExample){
                            this.__addAsExample(runUUID, input, result)
                        }

                        return result
                    } else {
                        // No timeout - direct execution
                        const result = onStream ? await this.__invokeWithStream(
                            runUUID,
                            chain as RunnableSequence<any, any>,
                            input,
                            options,
                            isOutcomeFromResponseFormatter,
                            config,
                            signal,
                            onStream
                        ) : await this.__invokeWithoutStream(
                            runUUID,
                            chain as RunnableSequence<any, any>,
                            input,
                            options,
                            isOutcomeFromResponseFormatter,
                            config,
                            signal
                        )

                        if(!result){
                            throw new Error("NO_RESULT_FOUND")
                        }

                        // TODO typing fix
                        if(((result as any) instanceof AIMessage || (result as any) instanceof AIMessageChunk) && (typeof (result as any).content === "string" && (result as any).content.length === 0) && toolsConfig.tools.length === 0){
                            if(throwErrorIfEmptyResponse){
                                throw new Error("EMPTY_RESPONSE")
                            }
                        }

                        // Optionally add to training dataset (fire-and-forget)
                        if(options.addAsExample){
                            this.__addAsExample(runUUID, input, result)
                        }

                        return result
                    }
                } catch(error){
                    lastError = error
                    
                    if(isTimeout){
                        throw new Error("LLM_TIMEOUT")
                    }

                    // Log retry attempt failure
                    if (options.allowRetries && attempt < maxAttempts - 1) {
                        this._logger?.warn({
                            errorType: "LLM_INVOKE_RETRY_FAILED",
                            message: error instanceof Error ? error.message : "Unknown error",
                            stack: error instanceof Error ? error.stack : undefined,
                            commit: this._commit,
                            model: setProviders[index]?.model || "unknown",
                            name: this._name,
                            attempt: attempt + 1,
                            maxAttempts,
                        }, "LLM_RETRY_FAILED")
                    }
                    
                    // If this was the last attempt for this provider, break out of retry loop
                    if (attempt === maxAttempts - 1) {
                        break
                    }
                }
            }

            // Store first error for potential re-throwing
            if(!initialError){
                initialError = lastError
            }

            // Log provider failure after all retry attempts
            this._logger?.error({
                errorType: "LLM_INVOKE_ERROR",
                message: lastError instanceof Error ? lastError.message : "Unknown error",
                stack: lastError instanceof Error ? lastError.stack : undefined,
                commit: this._commit,
                model: setProviders[index]?.model || "unknown",
                name: this._name,
                retriesEnabled: options.allowRetries || false,
                totalAttempts: maxAttempts,
            }, "CRITICAL_ERROR")

            // Move to next provider in fallback chain
            index++
            if(index === chatModels.length || this._isFake){
                this._logger?.warn({
                    errorType: "LLM_INVOKE_ERROR",
                    message: "Failed to invoke LLM",
                    commit: this._commit,
                    name: this.name,
                }, "NO_FALLBACK_AVAILABLE")
                break
            }
        }

        // All providers failed
        throw new Error("FAILED_TO_INVOKE_LLM")
    }

    /**
     * Private helper method to create a copy of the current instance with all properties
     * Used by override methods to create new instances instead of modifying the current one
     */
    private _createCopy(): LLMWrapper<I, O> {
        const newInstance = new LLMWrapper<I, O>(
            this._name,
            this._groupName,
            [...this._providers], // Copy the providers array
            this._inputSchema,
            this._outputSchema,
            this._fakeSpeed
        )
        
        // Copy all the initialized state
        newInstance._commit = this._commit
        newInstance._isInitialized = this._isInitialized
        newInstance._logger = this._logger
        newInstance._prompt = this._prompt
        newInstance._isFake = this._isFake
        newInstance._fakeResponses = this._fakeResponses
        newInstance._usageCallback = this._usageCallback
        newInstance._isCacheMode = this._isCacheMode
        newInstance._atCommit = this._atCommit
        
        return newInstance
    }

    /**
     * Override the provider
     * @param {TLLMProvider} provider The provider to override
     * @returns {LLMWrapper<I, O>} The new instance
     */
    public overrideProvider(provider: TLLMProvider): LLMWrapper<I, O> {
        const newInstance = this._createCopy()
        newInstance._providers = [provider]
        return newInstance
    }

    /**
     * Override the name
     * @param {string} name The name to override
     * @returns {LLMWrapper<I, O>} The new instance
     */
    public overrideName(name: string): LLMWrapper<I, O> {
        const newInstance = this._createCopy()
        newInstance._name = name
        return newInstance
    }

    /**
     * Get the free tier providers
     * @returns {TLLMProvider[]} The free tier providers
     */
    public getFreeTierProviders(): TLLMProvider[] {
        return [
            {
                provider: "ConfidentialPhalaLLM",
                model: "phala/deepseek-chat-v3-0324",
                temperature: 0.5
            },
        ]
    }

    /**
     * Get the cache mode
     * @returns {boolean} The cache mode
     */
    public get isCacheMode(): boolean {
        return this._isCacheMode
    }

    /**
     * Get the commit at which the prompt was cached
     * @returns {string} The commit at which the prompt was cached
     */
    public get atCommit(): string {
        return this._atCommit
    }
}