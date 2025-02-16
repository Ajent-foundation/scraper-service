import { JSONNode } from './newDomParser';

function isNotJsonString(str: string): boolean {
  try {
    JSON.parse(str);
    return false;
  } catch (e) {
    return true;
  }
}

function containsString(node: JSONNode, strings: string[]): boolean {
  const lowerCaseStrings = strings.map(str => str.toLowerCase());

  // Check attributes
  if (node.attributes) {
    for (const key in node.attributes) {
      if (node.attributes.hasOwnProperty(key)) {
        const value = node.attributes[key].toLowerCase();
        if (isNotJsonString(value) && lowerCaseStrings.some(str => value.includes(str))) {
          return true;
        }
      }
    }
  }

  // Check other fields
  const fieldsToCheck: (keyof JSONNode)[] = ['tag', 'content', 'type'];
  for (const field of fieldsToCheck) {
    const value = node[field];
    if (typeof value === 'string' && isNotJsonString(value) && lowerCaseStrings.some(str => value.toLowerCase().includes(str))) {
      return true;
    }
  }

  return false;
}

export function findFirstElementWithStrings(jsonNodes: JSONNode[], strings: string[], viewport: any): { [key: string]: JSONNode | null } {
  const foundElements: { [key: string]: JSONNode | null } = {};
  
  for (const str of strings) {
    foundElements[str] = null;
  }

  function searchNodes(nodes: JSONNode[]) {
    for (const node of nodes) {
      for (const str of strings) {
        if (!foundElements[str] && containsString(node, [str])) {
          if (node.x !== undefined && node.y !== undefined && node.width !== undefined && node.height !== undefined) {
            const elementRect = {
              left: node.x,
              top: node.y,
              right: node.x + node.width,
              bottom: node.y + node.height
            };

            if (
              elementRect.left >= viewport.left &&
              elementRect.top >= viewport.top &&
              elementRect.right <= viewport.right &&
              elementRect.bottom <= viewport.bottom
            ) {
              foundElements[str] = node;
            }
          }
        }
      }

      if (node.children) {
        searchNodes(node.children);
      }
    }
  }

  searchNodes(jsonNodes);
  
  return foundElements;
}

export function findElementsWithStrings(jsonNodes: JSONNode[], strings: string[], viewport:any): JSONNode[] {
  const foundElements: JSONNode[] = [];

  for (const node of jsonNodes) {
    if (containsString(node, strings)) {
      if (node.x !== undefined && node.y !== undefined && node.width !== undefined && node.height !== undefined) {
        const elementRect = {
          left: node.x,
          top: node.y,
          right: node.x + node.width,
          bottom: node.y + node.height
        };

        if (
          elementRect.left >= viewport.left &&
          elementRect.top >= viewport.top &&
          elementRect.right <= viewport.right &&
          elementRect.bottom <= viewport.bottom
        ) {
          foundElements.push(node);
        }
      }
    }

    if (node.children) {
      foundElements.push(...findElementsWithStrings(node.children, strings, viewport));
    }
  }
  return foundElements;
}
  
  function adjustBoundingBox(currentMinElement: JSONNode, candidateElement: JSONNode, allNodes: JSONNode[]): JSONNode {
    const containingElements: JSONNode[] = [];
  
    function searchNodes(nodes: JSONNode[]) {
      for (const node of nodes) {
        if (node.x !== undefined && node.y !== undefined && node.width !== undefined && node.height !== undefined) {
          if (
            node.x <= Math.min(currentMinElement.x!, candidateElement.x!) &&
            node.y <= Math.min(currentMinElement.y!, candidateElement.y!) &&
            node.x + node.width >= Math.max(currentMinElement.x! + currentMinElement.width!, candidateElement.x! + candidateElement.width!) &&
            node.y + node.height >= Math.max(currentMinElement.y! + currentMinElement.height!, candidateElement.y! + candidateElement.height!)
          ) {
            containingElements.push(node);
          }
        }
  
        if (node.children) {
          searchNodes(node.children);
        }
      }
    }
  
    searchNodes(allNodes);
  
    if (containingElements.length === 0 || containingElements.includes(currentMinElement)) {
      return currentMinElement;
    }
  
    let minArea = Infinity;
    let bestElement = containingElements[0];
  
    for (const element of containingElements) {
      const area = element.width! * element.height!;
      if (area < minArea) {
        minArea = area;
        bestElement = element;
      }
    }
  
    return bestElement;
  }
  
  export function findElementWithMinBoundingBox(jsonNodes: JSONNode[], strings: string[], viewport:any): JSONNode | null {
    // Find the string with exactly one element containing it
    let initialElements = [];
    if(strings.length > 1){
        let indexToSwap = -1;
        let elements;
        outerLoop:
        for (let i = 0; i < strings.length; i++) {
            let searchedString = strings[i];
            for(let j = 0; j < searchedString.length; j++){
              for (let k = j + 1; k < searchedString.length; k++){
                let substring = searchedString.slice(j, k);
                elements = findElementsWithStrings(jsonNodes, [substring], viewport);
                if (elements.length === 1) {
                  initialElements = elements;
                  indexToSwap = i;
                  break outerLoop;
                }
              }
            }
        }
        if (indexToSwap === -1){
            console.log("No element with exactly one string found");
            return null;
        }

        // Swap the found string with the string at index 0
        if (indexToSwap !== 0) {
          [strings[0], strings[indexToSwap]] = [strings[indexToSwap], strings[0]];
        }
    }

    try{
        if (initialElements.length === 0){
            console.log("error: element at index 0 not found");
            return null;
        }
      
        let currentMinElement = initialElements[0];
      
        for (let i = 1; i < strings.length; i++) {
          const elements = findElementsWithStrings(jsonNodes, [strings[i]], viewport);
          if (elements.length === 0) continue;
          
          let minIncrease = Infinity;
          let bestElement = elements[0];
          
          for (const element of elements) {
            const newBoundingBoxElement = adjustBoundingBox(currentMinElement, element, jsonNodes);
            const newArea = newBoundingBoxElement.width! * newBoundingBoxElement.height!;
            const currentArea = currentMinElement.width! * currentMinElement.height!;
            const areaIncrease = newArea - currentArea;
      
            if (areaIncrease < minIncrease) {
              minIncrease = areaIncrease;
              bestElement = newBoundingBoxElement;
            }
          }
          currentMinElement = bestElement;
        }
      
        return currentMinElement;
    }
    catch (e) {
        console.log("Error:", e);
        return null;
    }
  }