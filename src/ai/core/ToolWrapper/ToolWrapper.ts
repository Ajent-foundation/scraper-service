import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { RunnableConfig } from "@langchain/core/runnables";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export class ToolWrapper<I extends z.ZodObject, O extends z.ZodObject> {
    private _name: string;
    private _description: string;
    private _inputSchema: I;
    private _outputSchema: O;
    private _dynamicStructuredTool: DynamicStructuredTool<I>

    /** 
     * @param {string} name The name of the tool
     * @param {string} description The description of the tool
     * @param {Function} func The function to execute the tool
     * @param {I} inputSchema The input schema of the tool
     * @param {O} outputSchema The output schema of the tool
    */
    constructor(
        name: string, 
        description: string, 
        func: (
            input: z.infer<I>, 
            runManager?: CallbackManagerForToolRun, 
            config?: RunnableConfig
        ) => Promise<string>,
        inputSchema: I,
        outputSchema: O 
    ) {
        this._name = name;
        this._description = description;
        this._inputSchema = inputSchema
        this._outputSchema = outputSchema

        // Generate DynamicStructuredTool
        // TODO - fix when langchain core supports zod v4
        // @ts-ignore - limitation due to zod v3 in langchain core
        this._dynamicStructuredTool = new DynamicStructuredTool<I>({
            name: name,
            description: description,
            schema: inputSchema,
            // @ts-ignore - limitation due to zod v3 in langchain core
            func: func
        })   
    }

    // Getters
    /**
     * @returns {I} The inputScheme444
    */
    public get inputSchema() : I {
        return this._inputSchema;
    }

    /**
     * @returns {O} The output schema
    */
    public get outputSchema() : O {
        return this._outputSchema;
    }

    /** 
     * @returns {string} The name of the tool
    */
    public get name() : string {
        return this._name;
    }   

    /** 
     * @returns {string} The description of the tool
    */
    public get description() : string {
        return this._description;
    }

    /**
     * @returns {DynamicStructuredTool<I>} The dynamic tool
    */
    public get dynamicTool() : DynamicStructuredTool<I> {
        return this._dynamicStructuredTool;
    }

    // methods
    /**
     * @param {string} output The output to validate
     * @returns {z.infer<O>} The validated output
    */
    public async validateAndParseOutput(output: string) : Promise<z.infer<O>> {
        // parse json to object
        const outputObject = JSON.parse(output);
        // validate with zod
        return this._outputSchema.parse(outputObject);
    }
}