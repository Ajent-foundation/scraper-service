import { Annotation } from "@langchain/langgraph"

/**
 * MemoryState is a class that represents a state of a memory
 * @param I - The type of the state
 */
export class MemoryState<I = string> {
    private _name: string   
    private _defaultValue: I
    private _updater: ((x: I, y: I) => I)
    private _isSerializable: boolean

    constructor(
        name: string,
        defaultValue: I,
        isSerializable: boolean,
        updater ?: (x: I, y: I) => I,
    ){
        this._name = name
        this._defaultValue = defaultValue
        this._isSerializable = isSerializable

        // If no updates is provided, then it becomes replace old value
        if(updater === undefined) {
            updater = (_, y) => y
        }
        this._updater = updater
    }

    /** 
     * The name of the state
    */
    get name(): string {    
        return this._name
    }

    /** 
     * Whether the state is serializable when memory is dumped to db
    */
    get isSerializable(): boolean {
        return this._isSerializable
    }

    /** 
     * Return a channel that can be used to update the state
    */
    public buildDynamicChannel(){
        return Annotation<I>({
            reducer: this._updater,
            default: () => this._defaultValue
        })
    }

    /** 
     * Return a channel that can be used to update the state
    */
    public buildStaticChannel(){
        return Annotation<I>()
    }
}