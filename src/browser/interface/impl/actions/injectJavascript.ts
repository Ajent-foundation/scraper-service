import { Page } from 'puppeteer';

export interface IBody {
	code: string;
}

export default async function execute(
	page: Page,
	body: IBody,
) {
	// Run JavaScript code on the page
	try {
		// Directly passing the code string to page.evaluate()
		const result = await page.evaluate(body.code);
		return { result: result };
	} catch (error) {
		return {
			code: 'INVALID_CODE',
			message: 'Invalid code provided',
		};
	}
}
