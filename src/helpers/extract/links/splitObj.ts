function splitStringByUnknownDelimiter(input: string): string[] {
    // Use a regular expression to find the first non-alphanumeric character
    const delimiterMatch = input.match(/[^a-zA-Z0-9]/);
    
    if (!delimiterMatch) {
        // If no delimiter is found, return the original string in an array
        return [input];
    }

    // Get the first non-alphanumeric character
    const initialDelimiter = delimiterMatch[0];

    // Use a regular expression to find the delimiter which can be the initial non-alphanumeric character
    // followed by zero or more spaces and possibly the same character again
    const delimiterRegex = new RegExp(`${initialDelimiter}\\s*${initialDelimiter}?`, 'g');

    // Split the string using the identified delimiter
    return input.split(delimiterRegex);
}

export function processJsonObject(jsonObject: any): string[] {
    const resultArray: string[] = [];

    // Helper function to process each value
    function processValue(value: any) {
        if (typeof value !== 'string') {
            value = String(value);
        }

        // Check if the string contains only alphanumeric characters, spaces, or non-English alphabetical characters
        if (/^[a-zA-Z0-9\s\u00C0-\u024F-]*$/.test(value)) {
            resultArray.push(value);
        } else {
            // Use the delimiter function to split the string
            const splitArray = splitStringByUnknownDelimiter(value);
            resultArray.push(...splitArray);
        }
    }

    // Recursively process the JSON object
    function recursiveProcess(obj: any) {
        if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    recursiveProcess(obj[key]);
                }
            }
        } else {
            processValue(obj);
        }
    }

    // Start processing the JSON object
    recursiveProcess(jsonObject);

    return resultArray;
}