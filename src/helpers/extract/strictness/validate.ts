type Format = {
  [key: string]: string | Format[] | Format;
};

export function checkFormat(format: Format, obj: any, path: string = ''): boolean {
  // Helper function to extract the type from the format string
  function getTypeFromString(str: string): string {
    const match = str.match(/^\((\w+)\)/);
    return match ? match[1] : '';
  }

  console.log("format:", format);
  console.log("obj:", obj);
  console.log("path:", path);

  // Recursive function to validate the object
  function validate(format: Format, obj: any, path: string): boolean {
    for (const key in format) {
      if (!obj.hasOwnProperty(key)) {
        throw new Error(`Key "${path + key}" is missing`);
      }

      const formatValue = format[key];
      const objValue = obj[key];

      if (typeof formatValue === 'string') {

        const expectedType = getTypeFromString(formatValue);
        

                
        if(expectedType === 'number' && typeof objValue === 'string' && !isNaN(Number(objValue))) {
          obj[key] = Number(objValue);
        }

        if(expectedType === 'number' && typeof objValue === 'string') {
          let number = Number(objValue);
          if(!isNaN(number)){
            obj[key] = number;
          }
        }

        if(expectedType === 'boolean' && typeof objValue === 'string'){
          if(objValue === 'true' || objValue === 'false'){
            obj[key] = objValue === 'true';
          }
        }

        if(expectedType === 'string' && typeof objValue === 'boolean'){
          obj[key] = objValue.toString();
        }



        if (
          (expectedType === 'number' && typeof objValue !== 'number') ||
          (expectedType === 'string' && typeof objValue !== 'string') ||
          (expectedType === 'boolean' && typeof objValue !== 'boolean') ||
          (expectedType === 'bigint' && typeof objValue !== 'bigint') ||
          (expectedType === 'symbol' && typeof objValue !== 'symbol') ||
          (expectedType === 'undefined' && typeof objValue !== 'undefined') ||
          (expectedType === 'null' && objValue !== null)
        ) {
          throw new Error(`Type mismatch at "${path + key}". Expected ${expectedType} but found ${typeof objValue}`);
        }
      } else if (Array.isArray(formatValue)) {
        if (!Array.isArray(objValue)) {
          console.log("formatValue:", formatValue);
          console.log("objValue:", objValue);
          console.log("path:", path);
          console.log("key:", key);
          throw new Error(`Expected an array at "${path + key}"`);
        }
        for (let i = 0; i < objValue.length; i++) {
          if (typeof formatValue[0] === 'string') {
            const expectedType = getTypeFromString(formatValue[0]);


                        
            if(expectedType === 'number' && typeof objValue[i] === 'string' && !isNaN(Number(objValue[i]))) {
              obj[key] = Number(objValue[i]);
            }

            if(expectedType === 'number' && typeof objValue[i] === 'string') {
              let number = Number(objValue[i]);
              if(!isNaN(number)){
                obj[key] = number;
              }
            }

            if(expectedType === 'boolean' && typeof objValue[i] === 'string'){
              if(objValue[i] === 'true' || objValue[i] === 'false'){
                obj[key] = objValue[i] === 'true';
              }
            }

            if(expectedType === 'string' && typeof objValue[i] === 'boolean'){
              obj[key] = objValue[i].toString();
            }



            if (
              (expectedType === 'number' && typeof objValue[i] !== 'number') ||
              (expectedType === 'string' && typeof objValue[i] !== 'string') ||
              (expectedType === 'boolean' && typeof objValue[i] !== 'boolean') ||
              (expectedType === 'bigint' && typeof objValue[i] !== 'bigint') ||
              (expectedType === 'symbol' && typeof objValue[i] !== 'symbol') ||
              (expectedType === 'undefined' && typeof objValue[i] !== 'undefined') ||
              (expectedType === 'null' && objValue[i] !== null)
            ) {
              throw new Error(`Type mismatch at "${path + key}[${i}]". Expected ${expectedType} but found ${typeof objValue[i]}`);
            }
          } else {
            validate(formatValue[0], objValue[i], `${path + key}[${i}].`);
          }
        }
      } else if (typeof formatValue === 'object') {
        if (typeof objValue !== 'object' || objValue === null) {
          throw new Error(`Expected an object at "${path + key}"`);
        }
        validate(formatValue, objValue, `${path + key}.`);
      }
    }
    return true;
  }

  return validate(format, obj, path);
}



/* 

if(expectedType === 'number' && typeof objValue !== 'string' && !isNaN(Number(objValue))) {
  obj[key] = Number(objValue);
}

if(expectedType === 'number' && typeof objValue === 'string') {
  let number = Number(objValue);
  if(!isNaN(number)){
    obj[key] = number;
  }
}

if(expectedType === 'boolean' && typeof objValue === 'string'){
  if(objValue === 'true' || objValue === 'false'){
    obj[key] = objValue === 'true';
  }
}

if(expectedType === 'string' && typeof objValue === 'boolean'){
  obj[key] = objValue.toString();
}

*/