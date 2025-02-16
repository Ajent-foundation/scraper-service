import { Page } from 'puppeteer';

export interface IBody {
	x: number;
	y: number;
}

export default async function execute(page: Page, body: IBody) {
	// set select value
	const options = await page.evaluate(
		(x, y) => {
			let selectEl = document.elementFromPoint(x, y);
			// check if select tag
			if (selectEl.tagName != 'SELECT') return -1;
			else {
				//@ts-ignore
				let options = selectEl.options;
				let optionsArray = [];
				for (let i = 0; i < options.length; i++) {
					optionsArray.push(options[i].value);
				}
				return optionsArray;
			}
		},
		body.x,
		body.y,
	);

	if (options == -1)
		return {
			code: 'Invalid_Select_Element',
			message: 'Invalid select element',
		};
	else return { options: options };
}
