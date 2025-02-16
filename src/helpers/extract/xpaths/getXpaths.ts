import { findFirstElementWithStrings, findElementWithMinBoundingBox } from "../links/getMinimumBoundingBox";
import { JSONNode } from "../links/newDomParser";

export function getXPath(jsonNodes:JSONNode[], scrapedObj:object, viewport:any){
    const valuesAsStrings = Object.values(scrapedObj).map(value => String(value));
    const elements = findFirstElementWithStrings(jsonNodes, valuesAsStrings, viewport);
    let xPathedElements = {};
    Object.keys(elements).forEach(key => {
        xPathedElements[key] = elements[key] ? elements[key]!.xpath : null;
    });
    return xPathedElements;
}

export function getXpaths(jsonNodes:JSONNode[], scrapedObjs: object[], elements:any[]):string[]{
    
    let xpaths:any = [];
    for (let i = 0; i < scrapedObjs.length; i++){
        const scrapedObj = scrapedObjs[i];
        if(elements[i] === null){
            xpaths.push(null);
            continue;
        }
        const viewport = {
            left: elements[i].x,
            top: elements[i].y,
            right: elements[i].x + elements[i].width,
            bottom: elements[i].y + elements[i].height
        };
        let xpath = getXPath(jsonNodes, scrapedObj, viewport);
        xpaths.push(xpath);
    }
    return xpaths;
}