import { Page } from 'puppeteer';
import { findRepeated } from '../../../../webFuncs/findRepeated';
import { findRepeatedAuto } from '../../../../webFuncs/findRepeatedAuto';

export interface IBody {
    elmsCoords:  { x: number; y: number; tagName: string; }[];
    propertiesToCheck: {
		tagName: boolean;
		parent: boolean;
		className: boolean;
		backgroundColor: boolean;
		x: boolean;
		y: boolean;
		width: boolean;
		height: boolean;
		color: boolean;
		text: boolean;
		src: boolean;
		href: boolean;
		fontSize: boolean;
		fontWeight: boolean;
	};
}

export default async function execute(page: Page, body: IBody) {
    // check if all properties are false
    let allFalse = true;
    for (let prop in body.propertiesToCheck) {
        if (body.propertiesToCheck[prop] == true) {
            allFalse = false;
            break;
        }
    }

    if (body.elmsCoords.length > 1 && allFalse) {
        const repeatedElms = await page.evaluate(
            findRepeatedAuto,
            body.elmsCoords,
            body.propertiesToCheck,
        );
        
        return { elms: repeatedElms }
    } else {
        const repeatedElms = await page.evaluate(
            findRepeated,
            body.elmsCoords,
            body.propertiesToCheck,
        );
        
        return { elms: repeatedElms }
    }
}