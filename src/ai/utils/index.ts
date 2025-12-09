//@ts-nocheck
import { 
    BaseMessage, mapChatMessagesToStoredMessages, mapStoredMessagesToChatMessages, StoredMessage 
} from "@langchain/core/messages";


export function encoder(state: Record<string, unknown> | undefined) {
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

export function decoder(state: Record<string, unknown> | undefined) : Record<string, unknown> {
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