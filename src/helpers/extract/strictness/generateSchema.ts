type JsonObject = { [key: string]: any };
type JsonSchema = { type: string, properties?: { [key: string]: any }, items?: any, description?: string, required?: string[] };

function parseDescription(value: string): { type: string, description: string } {
    const match = value.match(/^\((\w+)\)\s*(.*)$/);
    if (match) {
        return {
            type: match[1],
            description: match[2]
        };
    } else {
        console.log("value:", value);
        console.log("match:", match);
        // throw new Error(`Invalid format: ${value}`);

        return {
            type: "string",
            description: value
        };
    }
}

export function generateSchema(obj: JsonObject): JsonSchema {
    const schema: JsonSchema = { type: "object", properties: {}, required: [] };

    for (const key in obj) {
        const value = obj[key];
        if (typeof value === 'string') {
            const { type, description } = parseDescription(value);
            schema.properties[key] = { type, description };
            schema.required.push(key);
        } else if (Array.isArray(value)) {
            if (value.length > 0) {
                const firstElement = value[0];
                if (typeof firstElement === 'string') {
                    const { type, description } = parseDescription(firstElement);
                    schema.properties[key] = {
                        type: "array",
                        items: { type, description }
                    };
                } else if (typeof firstElement === 'object') {
                    schema.properties[key] = {
                        type: "array",
                        items: generateSchema(firstElement)
                    };
                } else {
                    throw new Error(`Unsupported array element type for key ${key}: ${firstElement}`);
                }
                schema.required.push(key);
            } else {
                schema.properties[key] = {
                    type: "array",
                    items: {}
                };
                schema.required.push(key);
            }
        } else if (typeof value === 'object') {
            schema.properties[key] = generateSchema(value);
            schema.required.push(key);
        } else {
            throw new Error(`Unsupported value type for key ${key}: ${value}`);
        }
    }

    return schema;
}
