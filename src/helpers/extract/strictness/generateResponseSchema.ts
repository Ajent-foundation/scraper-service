type JsonObject = { [key: string]: any };
type JsonSchema = { 
    type: string, 
    properties?: { [key: string]: any }, 
    items?: any, 
    required?: string[], 
    additionalProperties?: boolean 
};

function inferTypeFromDescription(description: string): string {
    const match = description.match(/^\((\w+)\)/);
    if (match) {
        const type = match[1].toLowerCase();

        if (type.includes('number') || type.includes('int') || type.includes('float') || type.includes('double')) {
            return 'number';
        }
        if (type.includes('string') || type.includes('text')) {
            return 'string'; 
        }
        if (type.includes('bool') || type.includes('true') || type.includes('false')) {
            return 'boolean';
        }
        
        switch (type) {
            case 'string':
            case 'number':
            case 'boolean':
                return type;
            default:
                return 'string';
        }
    }
    return 'string';
}

export function generateResponseSchema(obj: JsonObject): JsonSchema {
    const schema: JsonSchema = { 
        type: "object", 
        properties: {}, 
        required: [] 
    };

    for (const key in obj) {
        const value = obj[key];
        if (typeof value === 'string') {
            const inferredType = inferTypeFromDescription(value);
            schema.properties![key] = { type: inferredType };
            schema.required!.push(key);
        } else if (Array.isArray(value)) {
            if (value.length > 0) {
                const firstElement = value[0];
                if (typeof firstElement === 'string') {
                    const inferredType = inferTypeFromDescription(firstElement);
                    schema.properties![key] = {
                        type: "array",
                        items: { type: inferredType }
                    };
                } else if (typeof firstElement === 'object' && firstElement !== null) {
                    const itemSchema = generateResponseSchema(firstElement);
                    itemSchema.additionalProperties = false;
                    schema.properties![key] = {
                        type: "array",
                        items: itemSchema
                    };
                } else {
                    throw new Error(`Unsupported array element type for key ${key}: ${firstElement}`);
                }
                schema.required!.push(key);
            } else {
                schema.properties![key] = {
                    type: "array",
                    items: {}
                };
                schema.required!.push(key);
            }
        } else if (typeof value === 'object' && value !== null) {
            const nestedSchema = generateResponseSchema(value);
            nestedSchema.additionalProperties = false;
            schema.properties![key] = nestedSchema;
            schema.required!.push(key);
        } else {
            throw new Error(`Unsupported value type for key ${key}: ${value}`);
        }
    }

    schema.additionalProperties = false;
    return schema;
}
