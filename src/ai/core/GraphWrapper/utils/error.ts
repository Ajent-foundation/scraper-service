/**
 * TErrorType is the type of the error
 */
export type TErrorType = unknown | undefined | null

/**
 * GraphError is a custom error class for graph errors
 */
export class GraphError extends Error {
    // Critical errors interrupt the graph execution.
    private _isCritical: boolean = false;
    private _isRetryable: boolean = false;
    private _prvError: {
        code: string,
        message: string,
    };
    /**
     * 
     * @param message a message to describe the error 
     * @param error the error that caused the graph error
     */
    constructor(
        message: string,
        error: {
            message: string,
            code: string,
        },
        isCritical: boolean = false,
    ) {
        super(message);
        this.name = "GraphError";
        this._prvError = error;
        this._isCritical = isCritical;
    }

    /** 
     * @returns a boolean indicating if the error is critical
    */
    get isCritical() {
        return this._isCritical;
    }

    /**
     * @returns a boolean indicating if the error is retryable
     */
    get isRetryable() {
        return this._isRetryable;
    }

    /**
     * @returns the error that caused the graph error
     */
    get prvError(){
        return this._prvError
    }
}

/**
 * isGraphError is a helper function to check if an error is a graph error
 * @param error a helper function to check if an error is a graph error
 * @returns a boolean indicating if the error is a graph error
 */
export function isGraphError(
    error: unknown
): error is GraphError {
    return error instanceof GraphError;
}
