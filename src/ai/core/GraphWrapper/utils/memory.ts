//@ts-nocheck
import { 
    BaseMessage, mapChatMessagesToStoredMessages, 
    mapStoredMessagesToChatMessages, StoredMessage 
} from "@langchain/core/messages";

/**
 * Encode the state
 * @param state - The state
 * @returns The encoded state
 */
export function encoder(memory: Record<string, unknown> | undefined) {
    // Deep copy the memory
    let state = {
        ...memory
    }

    if(!state) return {}
    for(const key in state){
        if (Array.isArray(state[key])) {
            // Check if all items are BaseMessage instances
            if (state[key].every((item: unknown) => item instanceof BaseMessage)) {
                state[key] = mapChatMessagesToStoredMessages(state[key] as BaseMessage[]);
            }
        } else if (state[key] instanceof BaseMessage) {
            state[key] = mapChatMessagesToStoredMessages([state[key]])[0];
        }
    }

    return JSON.stringify(state)
}

/**
 * Decode the state
 * @param rawMemory - The raw memory (need to reinstantiate langchain core objects)
 * @returns The decoded state
 */
export function decoder(rawMemory: Record<string, unknown> | undefined) : Record<string, unknown> {
    let state = {
        ...rawMemory
    }

    if(!state) return {}
    for(const key in state){
        if (Array.isArray(state[key])) {
            if (state[key].every((item: unknown) => isStoredMessage(item))) {
                state[key] = mapStoredMessagesToChatMessages(state[key] as StoredMessage[]);
            }
        } else if (isStoredMessage(state[key])) {
            const stored = mapStoredMessagesToChatMessages([state[key]]);
            state[key] = stored[0]
        }
    }

    return state 
}

/**
 * Check if the item is a stored message
 * @param item - The item
 * @returns True if the item is a stored message, false otherwise
 */
function isStoredMessage(item: unknown): item is StoredMessage {
    return (
        typeof item === 'object' && 
        item !== null && 
        'type' in item && 
        'data' in item &&
        typeof (item as StoredMessage).type === 'string' &&
        typeof (item as StoredMessage).data === 'object'
    );
}