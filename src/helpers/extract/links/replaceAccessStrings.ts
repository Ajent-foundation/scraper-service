import { accessPrimitive } from "./accessLinkByString";
import { saveJsonToFile } from "../saveToJSON";

export function replaceAccessStrings(jsonObject: any, array: any[]): any {
    // Helper function to check if a value is an access string
    function isAccessString(value: any): boolean {
        return typeof value === 'string' && /^\[\d+\]\['[^']+'\]$/.test(value);
    }

    // Recursive function to traverse and replace access strings
    function traverseAndReplace(obj: any): any {
        try{
            if (Array.isArray(obj)) {
                return obj.map(item => traverseAndReplace(item));
            } else if (typeof obj === 'object' && obj !== null) {
                const newObj: any = {};
                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        const value = obj[key];
                        if (isAccessString(value)) {
                            // Replace access string with the correct value
                            newObj[key] = accessPrimitive(array, value);
                        } else {
                            newObj[key] = traverseAndReplace(value);
                        }
                    }
                }
                return newObj;
            } else {
                return obj; // Directly return the primitive value (string, number, boolean, etc.)
            }
        } catch(e) {
            console.log("Error:", e);
            saveJsonToFile({filePath: "errorObj.json", data: jsonObject});
            saveJsonToFile({filePath: "ErrorArray.json", data: array});
        }
    }

    return traverseAndReplace(jsonObject);
}