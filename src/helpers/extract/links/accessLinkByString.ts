export function accessPrimitive(array: any[], accessString: string): any {
    const match = accessString.match(/^\[(\d+)\]\['([^']+)'\]$/);

    if (!match) {
        throw new Error(`Invalid access string format: ${accessString}. Expected format: '[index][object_property]'.`);
    }

    const index = parseInt(match[1], 10);
    const property = match[2];

    if (index < 0) {
        throw new Error(`Index ${index} is out of bounds for the array.`);
    }

    for(const obj of array){
        if(obj.index === index){
            if (!obj || !(property in obj)) {
                console.warn(`Property '${property}' does not exist in the object at index ${index}.`);
                console.log("index:", index);
                console.log("Object:", obj);
                console.log("accessString:", accessString);
                return "";
            }
        
            const value = obj[property];
        
            if (typeof value !== 'object' || value === null) {
                return value; // Return the primitive value
            } else {
                throw new Error("The accessed value is not a primitive.");
            }
        }
    }
}