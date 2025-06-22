import { Page } from 'puppeteer';

export interface IBody {
    latitude: number;
    longitude: number;
    accuracy?: number;
}

export default async function execute(
	page: Page,
	body: IBody,
) {
	// Click the element
    await page.setGeolocation({
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy: body.accuracy,
    });

	return {};
}
