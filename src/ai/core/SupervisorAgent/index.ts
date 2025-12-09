import { StateGraph, CompiledStateGraph, UpdateType, StateDefinition, StateType, START, END } from "@langchain/langgraph"
import { GlobalGraphState, TRootState } from "./memory"
import { drawGraph, initFileDebugger } from "../GraphWrapper/utils/index";
import { ConditionalNodeLambdaRunner, GraphError, NodeLambdaRunner } from "../GraphWrapper/index";
import { RETRY_POLICIES } from "./constants";
import { defaultGraphLogHandler } from "../GraphWrapper/index";
import { AIMessage, AIMessageChunk, BaseMessage, HumanMessage, ToolCall, ToolMessage } from "@langchain/core/messages";
import { TZodBaseToolDefinition, TLLMTool, TContext, TAgentIdentity, TStopCheckpoint, TJSONSchemaBaseToolDefinition, TJsonSchemaParameters } from "../common/index";
import { TGeneralAgent } from "../../prompts/agents/generalAgent";
import { randomUUID } from "crypto";
import { z } from "zod";

/**
 * Supervisor Agent
 * 
 * This agent is responsible for supervising the execution of the workers.
 * It is responsible for routing the messages to the appropriate workers.
 * It is also responsible for conducting an evaluation of the workers.
 */
export class SupervisorAgent<G extends {
    ctx:TContext
}, S extends z.ZodType = z.ZodTypeAny> {
    /** Whether to enable debug mode */
    private static readonly IS_DEBUG: boolean = true

    /** The name of the graph */
    private __graphName: string

    /** The description of the graph */
    private __description: string

    /** The compiled graph */
    private __graph: CompiledStateGraph<StateType<TRootState>, UpdateType<TRootState>, any, TRootState, TRootState, StateDefinition>
    private __workers: (SupervisorAgent<G> | TZodBaseToolDefinition<G, z.ZodRecord<z.ZodString, z.ZodUnknown>, typeof GlobalGraphState.State> | TJSONSchemaBaseToolDefinition<G, typeof GlobalGraphState.State>)[]
    private __todos: string[]
    private __currentTodoIndex: number
    private __onTodoUpdate?: (state: { todos: string[], currentIndex: number, currentItem: string | null, progress: string, isCompleted: boolean }) => void
    private __callbacks : {
        preToolCall ?: (global: G, toolCall: ToolCall) => Promise<void>
        afterToolCall ?: (global: G, toolCall: ToolCall, result: {
            text: string
            base64Images: string[]
        }) => Promise<void>
        onToolError ?: (global: G, toolCall: ToolCall, error: unknown) => Promise<void>
    } | undefined

    constructor(
        global: G,
        identity: TAgentIdentity,
        description: string,
        llm: TGeneralAgent,
        workers: (SupervisorAgent<G> | TZodBaseToolDefinition<G, z.ZodRecord<z.ZodString, z.ZodUnknown>, typeof GlobalGraphState.State> | TJSONSchemaBaseToolDefinition<G, typeof GlobalGraphState.State>)[],
        stop?: TStopCheckpoint<G, S>,
        shouldUseTodos: boolean = false,
        onTodoUpdate?: (state: { todos: string[], currentIndex: number, currentItem: string | null, progress: string, isCompleted: boolean }) => void,
        callbacks?: {
            preToolCall ?: (global: G, toolCall: ToolCall) => Promise<void>
            afterToolCall ?: (global: G, toolCall: ToolCall, result: {
                text: string
                base64Images: string[]
            }) => Promise<void>
            onToolError ?: (global: G, toolCall: ToolCall, error: unknown) => Promise<void>
        }
    ) {
        this.__graphName = identity.name
        this.__workers = workers
        this.__description = description
        this.__todos = []
        this.__currentTodoIndex = 0
        this.__onTodoUpdate = onTodoUpdate
        this.__callbacks = callbacks

        const { logFilePath, logToFile } = initFileDebugger(global.ctx.logger, this.__graphName)

        // Make sure llm is initialized
        if(!llm.isInitialized){
            throw new GraphError(
                "LLM is not initialized",
                {
                    code: "LLM_NOT_INITIALIZED",
                    message: "LLM is not initialized"
                }
            )
        }

        // handle subgraphs and regular tools
        const subGraphs: string[] = []
        for (const worker of workers) {
            if(
                worker instanceof SupervisorAgent
            ) {
                subGraphs.push(worker.name)
            }
        }

        // Dynamic Nodes Map Creation
        const NodesMap: Record<string, string> = {
            // Default
            [START]: START,
            [END]: END,
            
            // Flows
            agent: "agent",
            toolExecutor: "toolExecutor",
            ...subGraphs.reduce((acc, subGraph) => {
                acc[subGraph] = subGraph
                return acc
            }, {} as Record<string, string>),
        }

        // Create a graph
        const graph = new StateGraph(GlobalGraphState)
            // Nodes
            .addNode(
                NodesMap["agent"] as string,
                NodeLambdaRunner<typeof GlobalGraphState.State>(
                    async (
                        state, 
                        newStateChanges, 
                        logHandler
                    ) => {
                        if(!state.objective){
                            throw new GraphError(
                                "Objective is not set",
                                {
                                    code: "OBJECTIVE_NOT_SET",
                                    message: "Objective is not set"
                                }
                            )
                        }

                        const llmTools = this.__getToolDefinitionV1(stop, shouldUseTodos)
                        const aiResponse = await llm.invoke(
                            {
                                messages: state.messages,
                                expertise: identity.expertise,
                                role: identity.role,
                                objective: state.objective,
                                tools: identity.tools,
                                guidelines: identity.guidelines,
                                context: identity.context,
                            },
                            global.ctx.shouldRunFromConfiguredProviders ? global.ctx.configuredProviders[llm.name] ?? [] : [],
                            {
                                tools: llmTools,
                                // only tool choice if we have tools and stop is provided , otherwise auto
                                toolChoice: llmTools.length > 0 && stop ? "required" : "auto",
                                parallel_tool_calls: false
                            },
                            {
                                invoker: {
                                    requestUUID: randomUUID(),
                                    userUUID: "global.ctx.userUUID",
                                    chatRoomUUID: "global.ctx.chatRoomUUID",
                                    historyUUID: "global.ctx.historyUUID",
                                    taskUUID: "global.ctx.taskUUID",
                                },
                                addAsExample: global.ctx.addAsExample,
                                shouldRunFromConfiguredProviders: global.ctx.shouldRunFromConfiguredProviders,
                                tags: [
                                    process.env["NODE_ENV"] || "dev",
                                    SupervisorAgent.name,
                                ],
                            },
                            undefined,
                            undefined
                        );

                        // check for a stop tool call
                        // if stop is defined, we conduct an evaluation
                        if(stop){
                            const stopToolCall = aiResponse.tool_calls?.find(toolCall => toolCall.name === "stop")
                            if(stopToolCall && stop.evaluator){
                                // run evaluator
                                // if a reason is returned, we set it to the state (bad)
                                const stopRejectReason = await stop.evaluator(global, stopToolCall.args as z.infer<typeof stop.parameters>)
                                if(stopRejectReason){
                                    newStateChanges.stopRejectReason = stopRejectReason
                                } else {
                                    // check if todo is completed
                                    if(!stopToolCall.args['isCriticalError'] && shouldUseTodos && this.__todos.length > 0){
                                        const isCompleted = this.__currentTodoIndex >= this.__todos.length
                                        if(!isCompleted){
                                            newStateChanges.stopRejectReason = "TODO list is not completed, you cannot stop yet."
                                        }
                                        newStateChanges.messages = [aiResponse]
                                        return newStateChanges
                                    }
                                    
                                    // remove stop tool call
                                    aiResponse.tool_calls = []
                                    try {
                                        newStateChanges.messages = [
                                            new HumanMessage(JSON.stringify(stopToolCall.args)),
                                        ] 
                                    } catch (error: unknown) {
                                        newStateChanges.messages = [
                                            new HumanMessage(`Final Answer:\n${stopToolCall.args['response'] || "sub-task completed."}`),
                                        ] 
                                    }
                                    return newStateChanges
                                }
                            }
                        }
                        
                        await logHandler(["aiResponse", aiResponse])
                        newStateChanges.messages = [aiResponse]
                        return newStateChanges
                    },
                    defaultGraphLogHandler(logFilePath, logToFile, global.ctx.logger),
                    [],
                    false,
                    {}
                ).withConfig({
                    metadata: {}
                }),
                {
                    retryPolicy: RETRY_POLICIES['ALWAYS']
                }
            )
            .addNode(
                NodesMap["toolExecutor"] as string,
                NodeLambdaRunner<typeof GlobalGraphState.State>(
                    async (
                        state, 
                        newStateChanges, 
                        logHandler,
                        config
                    ) => {
                        const { messages } = state;
                        if(messages.length === 0){
                            throw new GraphError(
                                "No messages found in state",
                                {
                                    code: "EMPTY_MESSAGES",
                                    message: "Cannot process agent node with empty messages array"
                                }
                            )
                        }
                
                        // We expect last message from ai (tool selection)
                        const lastMessage = messages[messages.length - 1] as AIMessage;
                        if (lastMessage.type !== "ai") {
                            throw new GraphError(
                                "Last message is not an AI message",
                                {
                                    code: "LAST_MESSAGE_NOT_AI",
                                    message: "Cannot process agent node with non-AI message"
                                }
                            )
                        }
                
                        // Execute 
                        const toolResults: ToolMessage[] = []
                        const extraHumanMessages: HumanMessage[] = []
                        if (lastMessage.tool_calls){
                            for (const toolCall of lastMessage.tool_calls) {
                                try {
                                    // check if the tool is a stop tool
                                    if(toolCall.name === "stop"){
                                        toolResults.push(
                                            new ToolMessage({
                                                content: JSON.stringify(state.stopRejectReason),
                                                status: "error",
                                                name: toolCall.name,
                                                tool_call_id: toolCall.id ?? "",
                                            })
                                        )
                                        break;
                                    }

                                    // Handle TODO tools
                                    if(toolCall.name === "setTodo"){
                                        try {
                                            const { todos } = toolCall.args as { todos: string[] };
                                            this.__todos = [...todos];
                                            this.__currentTodoIndex = 0;
                                            this.__onTodoUpdate?.({
                                                todos: this.__todos,
                                                currentIndex: this.__currentTodoIndex,
                                                currentItem: this.__currentTodoIndex < this.__todos.length ? this.__todos[this.__currentTodoIndex] ?? null : null,
                                                progress: `${this.__currentTodoIndex}/${this.__todos.length}`,
                                                isCompleted: this.__currentTodoIndex >= this.__todos.length,
                                            });
                                            
                                            toolResults.push(
                                                new ToolMessage({
                                                    content: JSON.stringify({
                                                        message: `TODO list set with ${this.__todos.length} items`,
                                                        currentIndex: this.__currentTodoIndex,
                                                        currentItem: this.__currentTodoIndex < this.__todos.length ? this.__todos[this.__currentTodoIndex] : "All completed!",
                                                        progress: `${this.__currentTodoIndex}/${this.__todos.length}`,
                                                        todos: this.__todos.map((todo, index) => ({
                                                            index,
                                                            description: todo,
                                                            status: index < this.__currentTodoIndex ? "✅ Done" : 
                                                                   index === this.__currentTodoIndex ? "🔄 Current" : "⏳ Pending"
                                                        }))
                                                    }),
                                                    status: "success",
                                                    name: toolCall.name,
                                                    tool_call_id: toolCall.id ?? "",
                                                })
                                            )
                                        } catch (error: unknown) {
                                            toolResults.push(
                                                new ToolMessage({
                                                    content: JSON.stringify({
                                                        message: error instanceof Error ? error.message : "Error setting TODO list",
                                                        type: "tool_error",
                                                    }),
                                                    status: "error",
                                                    name: toolCall.name,
                                                    tool_call_id: toolCall.id ?? "",
                                                })
                                            );
                                        }
                                        continue;
                                    }

                                    if(toolCall.name === "todoStepIn"){
                                        try {
                                            if (this.__currentTodoIndex < this.__todos.length) {
                                                const completedItem = this.__todos[this.__currentTodoIndex];
                                                this.__currentTodoIndex++;
                                                this.__onTodoUpdate?.({
                                                    todos: this.__todos,
                                                    currentIndex: this.__currentTodoIndex,
                                                    currentItem: this.__currentTodoIndex < this.__todos.length ? this.__todos[this.__currentTodoIndex] ?? null : null,
                                                    progress: `${this.__currentTodoIndex}/${this.__todos.length}`,
                                                    isCompleted: this.__currentTodoIndex >= this.__todos.length,
                                                });
                                                
                                                toolResults.push(
                                                    new ToolMessage({
                                                        content: JSON.stringify({
                                                            message: `Completed: "${completedItem}"`,
                                                            currentIndex: this.__currentTodoIndex,
                                                            currentItem: this.__currentTodoIndex < this.__todos.length ? this.__todos[this.__currentTodoIndex] : "All completed!",
                                                            progress: `${this.__currentTodoIndex}/${this.__todos.length}`,
                                                            isCompleted: this.__currentTodoIndex >= this.__todos.length,
                                                            todos: this.__todos.map((todo, index) => ({
                                                                index,
                                                                description: todo,
                                                                status: index < this.__currentTodoIndex ? "✅ Done" : 
                                                                       index === this.__currentTodoIndex ? "🔄 Current" : "⏳ Pending"
                                                            }))
                                                        }),
                                                        status: "success",
                                                        name: toolCall.name,
                                                        tool_call_id: toolCall.id ?? "",
                                                    })
                                                )
                                            } else {
                                                toolResults.push(
                                                    new ToolMessage({
                                                        content: JSON.stringify({
                                                            message: "All TODO items are already completed!",
                                                            currentIndex: this.__currentTodoIndex,
                                                            progress: `${this.__currentTodoIndex}/${this.__todos.length}`,
                                                            isCompleted: true
                                                        }),
                                                        status: "success",
                                                        name: toolCall.name,
                                                        tool_call_id: toolCall.id ?? "",
                                                    })
                                                )
                                            }
                                        } catch (error: unknown) {
                                            toolResults.push(
                                                new ToolMessage({
                                                    content: JSON.stringify({
                                                        message: error instanceof Error ? error.message : "Error stepping through TODO list",
                                                        type: "tool_error",
                                                    }),
                                                    status: "error",
                                                    name: toolCall.name,
                                                    tool_call_id: toolCall.id ?? "",
                                                })
                                            );
                                        }
                                        continue;
                                    }

                                    // if todo mode but todo list not set, throw error (except for setTodo and think tools)
                                    if(shouldUseTodos && this.__todos.length === 0 && toolCall.name !== "setTodo" && toolCall.name !== "think"){
                                        throw Error("TODO list not set, you must set it first.")
                                    }

                                    // Tool Registry (each is a graph by its own)
                                    const tool = this.__workers.find(tool => tool.name === toolCall.name)
                                    if(tool && !(tool instanceof SupervisorAgent)){
                                        if(this.__callbacks && this.__callbacks.preToolCall){
                                            await this.__callbacks.preToolCall(global, toolCall)
                                        }
                                        const toolResult = await tool.implementation(global, toolCall.args, state)
                                        if(typeof toolResult === "string"){
                                            toolResults.push(
                                                new ToolMessage({
                                                    content: JSON.stringify(toolResult),
                                                    status: "success",
                                                    name: toolCall.name,
                                                    tool_call_id: toolCall.id ?? "",
                                                })
                                            )
                                            if(this.__callbacks && this.__callbacks.afterToolCall){
                                                await this.__callbacks.afterToolCall(global, toolCall, {
                                                    text: toolResult,
                                                    base64Images: [],
                                                })
                                            }
                                        } else {
                                            toolResults.push(
                                                new ToolMessage({
                                                    content: JSON.stringify(toolResult.text),
                                                    status: "success",
                                                    name: toolCall.name,
                                                    tool_call_id: toolCall.id ?? "",
                                                })
                                            )
                                            if(toolResult.base64Images.length > 0){
                                                extraHumanMessages.push(
                                                    new HumanMessage({
                                                        content: [
                                                            {
                                                                type: "text",
                                                                text: "The generated images:\n",
                                                            },
                                                            ...toolResult.base64Images.map(image => ({
                                                                type: "image_url",
                                                                image_url: {
                                                                    url: image,
                                                                },
                                                            })),
                                                        ],
                                                    }),
                                                )
                                            }
                                            if(this.__callbacks && this.__callbacks.afterToolCall){
                                                await this.__callbacks.afterToolCall(global, toolCall, {
                                                    text: toolResult.text,
                                                    base64Images: toolResult.base64Images,
                                                })
                                            }
                                        }
                                    } else {
                                        toolResults.push(
                                            new ToolMessage({
                                                content: JSON.stringify({
                                                    message: `Tool ${toolCall.name} not found.`,
                                                    type: "tool_error",
                                                }),
                                                status: "error",
                                                name: toolCall.name,
                                                tool_call_id: toolCall.id ?? "",
                                            })
                                        )
                                    }
                                } catch (error: unknown) {
                                    if(this.__callbacks && this.__callbacks.onToolError){
                                        await this.__callbacks.onToolError(global, toolCall, error)
                                    }
                                    toolResults.push(
                                        new ToolMessage({
                                            content: JSON.stringify({
                                                message: error instanceof Error ? error.message : "Unknown error has occurred",
                                                stack: error instanceof Error ? error.stack : undefined,
                                                type: "tool_error",
                                            }),
                                            status: "error",
                                            name: toolCall.name,
                                            tool_call_id: toolCall.id ?? "",
                                        })
                                    );
                                } 
                            }
                        }
                
                        // Update
                        newStateChanges.messages = [
                            ...toolResults,
                            ...extraHumanMessages,
                        ]
                        return newStateChanges
                    },
                    defaultGraphLogHandler(logFilePath, logToFile, global.ctx.logger),
                    [],
                    false,
                    {}
                ).withConfig({
                    metadata: {}
                }),
                {
                    retryPolicy: RETRY_POLICIES['NEVER']
                }
            )
        
        // Attach Edges
        .addEdge(START, NodesMap["agent"] as string)
        .addEdge(NodesMap["toolExecutor"] as string, NodesMap["agent"] as string)

        // Add Conditional Edges
        .addConditionalEdges(
            NodesMap["agent"] as string, 
            ConditionalNodeLambdaRunner<typeof GlobalGraphState.State, typeof NodesMap>(
                async (
                    state,
                ) => {
                    const lastMessage = state.messages[state.messages.length - 1]
                    if(
                        (
                            lastMessage instanceof AIMessage || lastMessage instanceof AIMessageChunk 
                        ) && 
                        lastMessage.tool_calls && 
                        lastMessage.tool_calls.length > 0
                    ){
                        // Check if there is a stop tool call
                        const stopToolCall = lastMessage.tool_calls.find(toolCall => toolCall.name === "stop")
                        if(!stopToolCall){
                            // decide if should route to toolExecutor or to subGraphs
                            const toolCall = lastMessage.tool_calls[0]
                            if(toolCall){
                                const toolDefinition = this.__workers.find(tool => tool.name === toolCall.name)
                                if(toolDefinition && (toolDefinition instanceof SupervisorAgent)){
                                    return NodesMap[toolDefinition.name] as string
                                }

                                // Not subGraph, route to toolExecutor
                                return NodesMap["toolExecutor"] as string
                            }
                        }
                    }
            
                    return NodesMap[END] as string
                },
                defaultGraphLogHandler(logFilePath, logToFile, global.ctx.logger),
                {}
            ), {
                "toolExecutor": NodesMap["toolExecutor"] as string,
                ...subGraphs.reduce((acc, subGraph) => {
                    acc[subGraph] = NodesMap[subGraph] as string
                    return acc
                }, {} as Record<string, string>),
                [END]: NodesMap[END] as string
            }
        )

        // Add Missing Subgraph Edges & Nodes (subgraphs insertion)
        subGraphs.forEach(subGraph => {
            const worker = workers.find(worker => worker.name === subGraph)
            if(worker instanceof SupervisorAgent){
                graph.addNode(NodesMap[subGraph] as string, 
                    async (state) => {
                        const newMessages = []

                        //Get last message
                        const lastMessage = state.messages[state.messages.length - 1]
                        let objective = state.objective
                        let toolCallId = ""
                        if(lastMessage instanceof AIMessage || lastMessage instanceof AIMessageChunk){
                            const content = lastMessage.content.toString()
                            if(content && content.length > 0){
                                newMessages.push(new HumanMessage(content))
                            } else {
                                newMessages.push(new AIMessage(`Delegate the sub-task to ${subGraph} and report back the progress.`))
                            }

                            // check tool calls
                            if(lastMessage.tool_calls && lastMessage.tool_calls.length > 0){
                                for(const toolCall of lastMessage.tool_calls){
                                    if(toolCall.name === subGraph){
                                        objective = toolCall.args['objective']
                                        toolCallId = toolCall.id ?? ""
                                    }
                                }
                            }
                        }

                        // if todo mode but todo list not set, throw error
                        if(shouldUseTodos && this.__todos.length === 0){
                            return {
                                messages: [
                                    new ToolMessage({
                                        content: "TODO list not set, you must set it first.",
                                        status: "error",
                                        name: subGraph,
                                        tool_call_id: toolCallId,
                                    })
                                ]
                            }
                        }

                        const messagesToBePassed = state.messages.slice(0, -1)
                        let filteredMessages: BaseMessage[] = messagesToBePassed
                        if(shouldUseTodos){
                            // filter those messages from any ai message with tool_calls (setTodo, todoStepIn) 
                            // filter from any ToolMessage with tool_call_id (setTodo, todoStepIn)
                            filteredMessages = messagesToBePassed.filter(message => {
                                if(message instanceof AIMessage){
                                    return !message.tool_calls?.some(toolCall => toolCall.name === "setTodo" || toolCall.name === "todoStepIn")
                                }
                                if(message instanceof ToolMessage){
                                    return !message.name?.includes("setTodo") && !message.name?.includes("todoStepIn")
                                }
                                return true
                            })
                        }

                        // Remove the last message (supervisor message)
                        const result = await worker.graph.invoke({
                            objective,
                            messages: [
                                ...filteredMessages,
                                ...newMessages
                            ]
                        }, {
                            recursionLimit: 50,
                        })

                        const finalAnswerMessage = result.messages[result.messages.length - 1]
                        if(!finalAnswerMessage){
                            throw new GraphError(
                                "No final answer message found",
                                {
                                    code: "NO_FINAL_ANSWER_MESSAGE",
                                    message: "No final answer message found"
                                }
                            )
                        }
                        return {
                            messages: [
                                new ToolMessage({
                                    content: finalAnswerMessage.content.toString(),
                                    status: "success",
                                    name: subGraph,
                                    tool_call_id: toolCallId,
                                })
                            ]
                        }
                        
                    }
                )
                graph.addEdge(NodesMap[subGraph] as string, NodesMap["agent"] as string)
            }
        })

        // Compile the graph
        const compiledGraph = graph.compile({}).withConfig({
            runName: this.__graphName,
            metadata: {},
            tags: []
        })

        this.__graph = compiledGraph
        if(SupervisorAgent.IS_DEBUG){
            drawGraph(global.ctx.logger, this.__graphName, compiledGraph)
        }
    }

    private __getToolDefinitionV1(stop?: TStopCheckpoint<G, S>, shouldUseTodos: boolean = false): TLLMTool[] {
        const v2ToolDefinitions: (TLLMTool | undefined)[] = this.__workers.map(tool => {
            
            if(tool instanceof SupervisorAgent){
                return {
                    type: "function",
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: z.toJSONSchema(
                            z.object({
                                objective: z.string().describe("Produce a detailed objective for the sub-task (sub-task requirements)."),
                            })
                        )
                    }
                }
            }

            // if it has zodParameters, use it
            if("zodParameters" in tool){
                return {
                    type: "function",
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: z.toJSONSchema(
                            tool.zodParameters
                        )
                    }
                }
            }
            
            else if("jsonSchemaParameters" in tool){
                return {
                    type: "function",
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.jsonSchemaParameters as TJsonSchemaParameters
                    }
                }
            }

            return undefined
        })

        // Prepare additional tools
        const additionalTools: TLLMTool[] = []

        // Add stop tool if needed
        if(stop){
            additionalTools.push({
                type: "function",
                function: {
                    name: "stop",
                    description: "This is a tool that can be used to stop due to completion of the task",
                    parameters: z.toJSONSchema(
                        stop.parameters
                    )
                }
            })
        }

        // Add TODO tools if needed
        if(shouldUseTodos){
            additionalTools.push(
                {
                    type: "function",
                    function: {
                        name: "setTodo",
                        description: "[MUST ALWAYS SET IT ONCE ONLY] Set the list of TODO items. This initializes the TODO list and sets the current progress index to 0.",
                        parameters: z.toJSONSchema(
                            z.object({
                                todos: z.array(z.string()).describe("The list of TODO items to set")
                            })
                        )
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "todoStepIn",
                        description: "Move to the next TODO item. This increments the current progress index to mark the current item as completed and move to the next one.",
                        parameters: z.toJSONSchema(
                            z.object({})
                        )
                    }
                }
            )
        }

        return [
            ...additionalTools,
            ...v2ToolDefinitions.filter((tool): tool is TLLMTool => tool !== undefined)
        ]
    }

    /** Get the compiled graph */
    public get graph(){
        return this.__graph
    }

    public get name(){
        return this.__graphName
    }

    public get description(){
        return this.__description
    }

    public get todos(){
        return {
            items: this.__todos,
            currentIndex: this.__currentTodoIndex,
            currentItem: this.__currentTodoIndex < this.__todos.length ? this.__todos[this.__currentTodoIndex] : null,
            progress: `${this.__currentTodoIndex}/${this.__todos.length}`,
            isCompleted: this.__currentTodoIndex >= this.__todos.length
        }
    }
}