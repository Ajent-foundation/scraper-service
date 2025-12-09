import { RetryPolicy } from "@langchain/langgraph";

/**
 * The retry policies
 */
export const RETRY_POLICIES: Record<string, RetryPolicy> = {
    ALWAYS: {
        initialInterval: 500,
        backoffFactor: 2,
        maxInterval: 128000,
        maxAttempts: 3,
        retryOn: (_:unknown) => true
    },
    NEVER: {
        initialInterval: 0,
        backoffFactor: 0,
        maxInterval: 0,
        maxAttempts: 0,
        retryOn: (_:unknown) => false
    },
}