import { KeyInput, Page } from 'puppeteer';

export interface IBody {
    key: KeyInput;
}

export default async function execute(
	page: Page,
	body: IBody,
) {
	// Click the element
	await page.keyboard.press(
        body.key,
    )

	return {};
}
