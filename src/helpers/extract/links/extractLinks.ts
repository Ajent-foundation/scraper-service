import { Page } from 'puppeteer';
import { extractJSON, JSONNode } from './newDomParser';
import { findElementWithMinBoundingBox } from './getMinimumBoundingBox';
import { findLinksAndImagesWithinNode, LinkImageObj } from './findLinksAndImagesInNode';
import { processJsonObject } from './splitObj';
import { saveJsonToFile } from '../saveToJSON';

export async function extractLinksAndMinBoundingBoxElements(extractedJSON:JSONNode[], scrapedObjs: object[], viewport:any): Promise<any>{
    console.log("Extracting links...");
    let linksAndImages: LinkImageObj[] = [];
    let minBoundingBoxElements = [];
    for(let scrapedObj of scrapedObjs){
        const searchedNodes = processJsonObject(scrapedObj);
        try{
        let minBoundingBoxElement = findElementWithMinBoundingBox(extractedJSON, searchedNodes, viewport);

        minBoundingBoxElements.push(minBoundingBoxElement);
        let partialLinksAndImages = findLinksAndImagesWithinNode(minBoundingBoxElement as JSONNode, extractedJSON);
        linksAndImages.push(partialLinksAndImages);
        } catch (e) {
            console.log("Error:", e);
            linksAndImages.push([] as LinkImageObj);
        }
    }
    return {linksAndImages, minBoundingBoxElements};
}