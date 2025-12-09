
import { NodeInterrupt } from "@langchain/langgraph"
import { RunnableConfig, RunnableLambda } from "@langchain/core/runnables"
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch"
import { GraphError, TErrorType, logMemory, TLogHandler } from "../utils";

/**
 * TNodeStates is the base state structure for a node
 */
export type TNodeStates = {
    error: TErrorType,
}

/**
 * The node implementation function type
 */
export type TNodeImplementation<S extends {error: TErrorType}> = (
    state: S, 
    updatedState: Partial<S>, 
    logHandler: (log: [string, unknown]) => Promise<void>,
    config?: RunnableConfig,
) => Promise<Partial<S>>

/**
 * The conditional node implementation function type
 */
export type TNodeConditionalImplementation<S, K> = (
    state: S, 
    logHandler: (log: [string, unknown]) => Promise<void>,
    config?: RunnableConfig,
) => Promise<K>

/**
 * NodeLambdaRunner is a helper function to run a node lambda function
 * @param nodeImplementation a function that implements the node logic
 * @param logHandler a function to handle logs
 * @param isDebug a flag to enable debug logs
 * @returns a lambda function that runs the node logic
 */
export const NodeLambdaRunner = <S extends TNodeStates>(
    nodeImplementation: TNodeImplementation<S>,
    logHandler: TLogHandler,
    keysToSeparateInLogs: string[],
    shouldUpdateThread: boolean,
    metadata: Record<string, string>,
) => {
    return RunnableLambda.from<S, Partial<S>>(
        async (
            state, 
            config
        ) => {
            // Metadata to be passed to log Handler
            const logMetadata:Record<string, unknown> =  {
                ...metadata,
                nodeName: config?.metadata['langgraph_node'] || "N/A",
                runId: config?.metadata['langgraph_runId'] || "N/A",
                step: config?.metadata['langgraph_step'] || "N/A",
            }

            // PRE
            await logHandler(`START [${logMetadata['nodeName']}] at step [${logMetadata['step']}]`, logMetadata)
            await logMemory("currentState", state, keysToSeparateInLogs, logHandler, logMetadata)

            // Start timing
            const startTime = performance.now();            
            try {
                if(shouldUpdateThread){
                    await dispatchCustomEvent("event", {
                        output: {
                            name: "thread-update",
                            payload: {
                                data: {...state},
                                nodeName: config?.metadata['langgraph_node'] || "N/A"
                            }
                        },
                    })
                }    
            } catch(error: unknown){
                await logHandler(["ERROR_UPDATING_THREAD", {
                    message: error instanceof Error ? error.message : "An unknown error has occurred",
                    stack: error instanceof Error ? error.stack : "N/A",
                    type: "ERROR_UPDATING_THREAD",
                }], logMetadata)
            }

            // Execute the node
            const newStateChanges : Partial<S> = {}
            try {
               if (state.error){
                    if(!config?.metadata.recoverable){
                        let errorMessage = "An unknown error has occurred, please try again."
                        let error = {
                            message: errorMessage,
                            code: "UNASSIGNED_ERROR_THROWN",
                        }
                        if (state.error instanceof GraphError){
                            errorMessage = state.error.message
                            error = state.error.prvError
                        }

                        await logHandler(["UnrecoverableErrorThrown", state.error], logMetadata)
                        throw new GraphError(errorMessage, error, true)
                    }
                }

                // Node Logic Execution
                await nodeImplementation(
                    state, 
                    newStateChanges,
                    // Wrap error with metadata
                    async (log: [string, unknown]) => await logHandler(log, logMetadata),
                    config,
                )

                newStateChanges.error = null
            } catch (error:unknown) {
                if (error instanceof GraphError){
                    await logHandler(["graphError", error.prvError], logMetadata)

                    // Error will cause the node to not update the state
                    // If we wish to continue the graph execution, this should not be critical
                    if (error.isCritical){
                        throw new NodeInterrupt(error.message)
                    }
                    
                    if (error.isRetryable){
                        // Throw the error to trigger a retry
                        throw new Error(error.prvError.message)
                    }

                    newStateChanges.error = error
                } 
                // Graph Interrupted (manually thrown [BAD])
                else if (error instanceof NodeInterrupt){
                    newStateChanges.error = new GraphError(`Requested Interrupt by:: ${logMetadata['nodeName']}`, {
                        message: "A node has requested an interrupt",
                        code: "NODE_INTERRUPTED",
                    }, true)
                }
                // This Error is thrown by unhandled code
                else {
                    // Unhandled error - critical
                    await logHandler(["UnhandledErrorThrown", {
                        message: error instanceof Error ? error.message : "An unknown error has occurred",
                        stack: error instanceof Error ? error.stack : "N/A"
                    }], logMetadata)
                    
                    throw error
                }
            }

            // End timing
            const endTime = performance.now();
            const executionTimeMs = endTime - startTime;

            // POST
            await logMemory("newStateChanges", newStateChanges, keysToSeparateInLogs, logHandler, logMetadata)
            await logHandler(["nodeImplementationExecutionTime", executionTimeMs / 1000], logMetadata);
            await logHandler(`END [${config?.metadata.langgraph_node}] with ${newStateChanges.error ? "ERROR" : "SUCCESS"}`, logMetadata)

            // Return result
            return newStateChanges
        }
    )
}

/**
 * ConditionalNodeLambdaRunner is a helper function to run a conditional node
 * @param nodeImplementation a function that implements the node logic
 * @param logHandler a function to handle logs
 * @param isDebug a flag to enable debug logs
 * @returns  a lambda function that runs the node logic
 */
export const ConditionalNodeLambdaRunner = <S extends TNodeStates, K> (
    nodeImplementation: TNodeConditionalImplementation<S, keyof K>,
    logHandler: TLogHandler,
    metadata: Record<string, string>,
) => {
    return (
        async (
            state: S,
            config?: RunnableConfig,
        ) => {
            // Metadata to be passed to log Handler
            const logMetadata:Record<string, unknown> =  {
                ...metadata,
                nodeName: config?.metadata?.['langgraph_node'] || "N/A",
                runId: config?.metadata?.['langgraph_runId'] || "N/A",
                step: config?.metadata?.['langgraph_step'] || "N/A",
            }

            const routeTo = await nodeImplementation(
                state,
                async(log: [string, unknown]) => await logHandler(log, logMetadata),
                config
            )
            
            logHandler(`routing from ${logMetadata['nodeName']} to ${String(routeTo)}`, logMetadata)
            return routeTo
        }
    )
}
