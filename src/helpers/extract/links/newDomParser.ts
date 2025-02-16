import { Page } from 'puppeteer';

export interface JSONNode {
    tag?: string;
    attributes?: { [key: string]: string };
    children?: JSONNode[];
    type?: 'text';
    content?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    xpath?: string;
}

export async function extractJSON(page: Page): Promise<JSONNode[]> {

    console.log("page viewport:", page.viewport());
    const nodes = await page.evaluate(() => {
        const getXPath = (node: Node): string => {
            if (node.nodeType === Node.DOCUMENT_NODE) {
                return '/';
            }
            const index = Array.from((node.parentNode as ParentNode)!.childNodes).indexOf(node as ChildNode) + 1;
            const tagName = node.nodeName.toLowerCase();
            return getXPath(node.parentNode as Node) + '/' + tagName + '[' + index + ']';
        };

        const getNodeInfo = (node: Node): JSONNode | null => {
            let obj: JSONNode | null = null;

            if (node.nodeType === 1) { // Element node
                const element = node as HTMLElement;
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    return null;
                }
                obj = {
                    tag: element.nodeName.toLowerCase(),
                    attributes: {},
                    children: [],
                    x: rect.left + window.scrollX,
                    y: rect.top + window.scrollY,
                    width: rect.width,
                    height: rect.height,
                    xpath: getXPath(element)
                };
                for (let attr of Array.from(element.attributes)) {
                    obj.attributes![attr.name] = attr.value;
                }
                console.log("obj:", obj);
                if (element.childNodes.length > 0) {
                    obj.children = Array.from(element.childNodes)
                        .map(child => getNodeInfo(child as Node))
                        .filter(child => child !== null) as JSONNode[];
                }
            } else if (node.nodeType === 3) { // Text node
                const textNode = node as Text;
                const range = document.createRange();
                range.selectNodeContents(textNode);

                const rect = range.getBoundingClientRect();
                obj = {
                    type: 'text',
                    content: textNode.nodeValue || '',
                    x: rect.left + window.scrollX,
                    y: rect.top + window.scrollY,
                    width: rect.width,
                    height: rect.height,
                    xpath: getXPath(textNode)
                };
            }
            return obj;
        };

        console.log("document.body.childNodes:", document.body.childNodes);
        let nodes: JSONNode[] = Array.from(document.body.childNodes)
            .map(child => getNodeInfo(child as Node))
            .filter(node => node !== null) as JSONNode[];
        console.log("nodes:", nodes);
        return nodes;
    });
    return nodes;
}