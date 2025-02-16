import { JSONNode } from './newDomParser';

interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

function computeBoundingBox(node: JSONNode): BoundingBox {
    if (node.x === undefined || node.y === undefined || node.width === undefined || node.height === undefined) {
        throw new Error('Node must have x, y, width, and height properties.');
    }

    return {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
    };
}

function isContainedWithin(rect: BoundingBox, container: BoundingBox): boolean {
    const isRectInContainer = (
        rect.x >= container.x &&
        rect.y >= container.y &&
        rect.x + rect.width <= container.x + container.width &&
        rect.y + rect.height <= container.y + container.height
    );

    const isContainerInRect = (
        container.x >= rect.x &&
        container.y >= rect.y &&
        container.x + container.width <= rect.x + rect.width &&
        container.y + container.height <= rect.y + rect.height
    );

    return isRectInContainer || isContainerInRect;
}

export interface LinkImage {
    href?: string;
    src?: string;
}

export class LinkImageObj {
    links?: LinkImage[] = [];
    images?: LinkImage[] = [];
}

export function findLinksAndImagesWithinNode(
    rootNode: JSONNode,
    jsonNodes: JSONNode[],
    foundElements: LinkImageObj = {links: [], images: []}
): LinkImageObj {
    const boundingBox = computeBoundingBox(rootNode);

    for (const node of jsonNodes) {
        if ((node.tag === 'a' || node.tag === 'img') &&
            node.x !== undefined && node.y !== undefined &&
            node.width !== undefined && node.height !== undefined) {
            const rect: BoundingBox = {
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height
            };
            
            if (isContainedWithin(rect, boundingBox)) {
                if (node.tag === 'a' && node.attributes?.href) {
                    foundElements.links.push({ href: node.attributes.href });
                } else if (node.tag === 'img' && node.attributes?.src) {
                    foundElements.images.push({ src: node.attributes.src });
                }
            }
        }

        if (node.children) {
            findLinksAndImagesWithinNode(rootNode, node.children, foundElements);
        }
    }
    return foundElements;
}