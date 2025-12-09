import { Annotation, BinaryOperatorAggregate, LastValue } from "@langchain/langgraph"
import { BaseMessage } from "@langchain/core/messages"
import { MemoryState} from "../GraphWrapper/index"

export type TRootState = {
    messages: BinaryOperatorAggregate<BaseMessage[]>
    error: BinaryOperatorAggregate<unknown|null, unknown|null>,
    stopRejectReason: LastValue<string|null>,
    objective: LastValue<string|null>,
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
})