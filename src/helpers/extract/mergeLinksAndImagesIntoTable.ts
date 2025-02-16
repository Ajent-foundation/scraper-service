import { LinkImageObj } from "./links/findLinksAndImagesInNode";

export function mergeLinkImagesIntoTables(linkImageObjs: LinkImageObj[][], tables: any[]): any[] {
    if (linkImageObjs.length !== tables.length) {
        throw new Error("LinkImageObjs and tables must have the same number of nested arrays");
    }

    return linkImageObjs.map((linkImageList, index) => {
        if (linkImageList.length !== tables[index].length) {
            throw new Error("Nested arrays in LinkImageObjs and tables must have the same length");
        }

        return linkImageList.map((linkImageObj, nestedIndex) => {
            return { ...tables[index][nestedIndex], ...linkImageObj };
        });
    });
}

export function mergeLinkImagesIntoTablesSingle(linkImageObjs: LinkImageObj[], tables: any[]): any[] {
    if (linkImageObjs.length !== tables.length) {
        throw new Error("LinkImageObjs and tables must have the same length");
    }

    return linkImageObjs.map((linkImageObj, index) => {
        return { ...tables[index], ...linkImageObj };
    });
}