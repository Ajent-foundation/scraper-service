import { readFileSync, writeFileSync } from "fs"
import { Logger } from "pino"

/**
 * defaultGraphLogHandler is a helper function to log to a file
 * @param logFilePath the path to the log file
 * @param logToFile a flag to enable logging to file
 * @param logInJson a flag to enable logging in json format
 */
export function defaultGraphLogHandler(
    logFilePath: string = "logs.json",
    logToFile: boolean = true,
    logger?: Logger
) {
    return async (
        valueToLog: string | [string, unknown], 
        metadata: Record<string, unknown>
    ) => {
        try{
            let jsonLog = "{}"
            const json: Record<string, unknown> = {
                ...metadata
            }
            
            // Handle key value pair
            if (Array.isArray(valueToLog)){
                json[valueToLog[0]] = valueToLog[1]
                json["message"] = valueToLog[0]
            } else {
                json["message"] = valueToLog
            }

            jsonLog = safeStringify(json) 

            // Log to console
            // Deprecate
            if (logToFile){
                // Check if the file exists
                let fileContent = "[]"
                try {
                    fileContent = readFileSync(logFilePath, "utf-8")
                } catch (error) {
                    writeFileSync(logFilePath, "[]")
                }

                // load json array
                const jsonFile = JSON.parse(fileContent)
                jsonFile.push(jsonLog)
                writeFileSync(logFilePath, JSON.stringify(jsonFile, null, 2))
            } 

            if(logger){
               logger.info(json, valueToLog instanceof Array ? valueToLog[0] : valueToLog)
            }
        } catch (error) {
            if(logger) logger.warn({
                message: error instanceof Error ? error.message : "Error logging to file",
                stack: error instanceof Error ? error.stack : undefined,
                type: "ERROR_LOGGING_TO_FILE"
            })
        }
    }
}

function safeStringify(obj: unknown, space?: number): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        // Handle BigInt
        if (typeof value === 'bigint') {
            return value.toString();
        }

        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular Reference]';
            }
            seen.add(value);
            
            // Handle special object types
            if (value instanceof Error) {
                return {
                    name: value.name,
                    message: value.message,
                    stack: value.stack
                };
            }
            if (value instanceof Map) {
                return Object.fromEntries(value);
            }
            if (value instanceof Set) {
                return Array.from(value);
            }
        }
        // Handle functions, undefined, and other non-JSON types
        if (typeof value === 'function') {
            return '[Function]';
        }
        if (typeof value === 'undefined') {
            return '[Undefined]';
        }
        if (typeof value === 'symbol') {
            return value.toString();
        }
        if (Number.isNaN(value)) {
            return '[NaN]';
        }
        return value;
    }, space);
}

/**
 * TLogHandler is a function to handle logs
 * if log is a string, it is a message
 * if log is a tuple, the first element is the message key and the second is the message value
 */
export type TLogHandler = (
    log: string | [string, unknown], 
    metadata: Record<string, unknown>
) => Promise<void>


/**
 * logMemory is a helper function to log the memory
 * @param state the state to log
 * @param keysToSeparateInLogs the keys to separate in logs
 * @param logHandler the log handler
 * @param logMetadata the log metadata
 */
export async function logMemory(
    logKey: string,
    state: Record<string, unknown>, 
    keysToSeparateInLogs: string[], 
    logHandler: TLogHandler, 
    logMetadata: Record<string, unknown>
){

    // Convert to func
    const stateCopy = {...state}
    const separateState : Record<string, unknown> = {}
    for (const key of keysToSeparateInLogs){
        if(state[key]){
            separateState[key] = state[key]
            delete stateCopy[key]
        }
    }

    // To avoid logging truncation, we separate the state into two logs
    await logHandler([logKey, stateCopy], logMetadata)
    for (const key of keysToSeparateInLogs){
        await logHandler([`${logKey}.${key}`, separateState[key]], logMetadata)
    }
}