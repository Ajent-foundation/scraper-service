import { Annotation, BinaryOperatorAggregate, LastValue } from "@langchain/langgraph"
import { BaseMessage } from "@langchain/core/messages"
import { MemoryState} from "../GraphWrapper/index"

/**
 * Represents a summarized chunk of messages.
 * Instead of storing all original messages, we store a summary and track the range.
 */
export type TSummarizedChunk = {
    /** Starting message index (inclusive) */
    fromIndex: number
    /** Ending message index (exclusive) */
    toIndex: number
    /** The summarized content as a single message */
    summary: BaseMessage
}

export type TRootState = {
    messages: BinaryOperatorAggregate<BaseMessage[]>
    error: BinaryOperatorAggregate<unknown|null, unknown|null>,
    stopRejectReason: LastValue<string|null>,
    objective: LastValue<string|null>,
    /** Tracks which message ranges have been summarized - replaces messages[fromIndex:toIndex] with summary */
    summarizedChunks: LastValue<TSummarizedChunk[]>,
}

// Memory composes of multiple AgentStates
export const GlobalGraphState =  Annotation.Root<TRootState>({
    error: new MemoryState<unknown|null>(
        "error",
        null,
        false,
        (a, b) => {
            if(a !== null) return a
            if(b !== null) return b
            return null
        },
    ).buildDynamicChannel(),
    messages: new MemoryState<BaseMessage[]>(
        "messages",
        [],
        true,
        (a, b) => a.concat(b),
    ).buildDynamicChannel(),
    stopRejectReason: new MemoryState<string|null>(
        "stopRejectReason",
        null,
        false
    ).buildStaticChannel(),
    objective: new MemoryState<string|null>(
        "objective",
        null,
        true
    ).buildStaticChannel(),
    summarizedChunks: new MemoryState<TSummarizedChunk[]>(
        "summarizedChunks",
        [],
        true
    ).buildStaticChannel(),
})