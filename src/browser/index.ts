import puppeteer, { Browser } from 'puppeteer';
import { BrowserConfig } from '../apis/browsers-cmgr';

export const VIEW_PORT = {
	width: 1280,
	height: 720,
};

export type TBrowserSettings = {
	isDebug: boolean;
	viewport: {
		width: number;
		height: number;
		deviceScaleFactor?: number;
	};
};

const CONNECT_ATTEMPT_DELAY = 5000;
const CONNECT_MAX_ATTEMPTS = 20;

export async function connectToBrowser(url: string): Promise<Browser> {
	let puppeteerBrowser: Browser;
	for (let i = 0; i < CONNECT_MAX_ATTEMPTS; i++) {
		try {
			puppeteerBrowser = (await Promise.race([
				puppeteer.connect(process.env.BAAS_ENABLED === "true" ? {
					browserWSEndpoint: url,
					defaultViewport: null,
				} : {
					browserURL: url,
					defaultViewport: null,
				}),
				new Promise((_, reject) => {
					setTimeout(
						() => reject(new Error('Connection timeout')),
						100,
					);
				}),
			])) as Browser;
			break;
		} catch (e) {
			if (i == CONNECT_MAX_ATTEMPTS - 1) {
				throw e;
			}
			await new Promise((resolve) =>
				setTimeout(resolve, CONNECT_ATTEMPT_DELAY),
			);
		}
	}

	return puppeteerBrowser;
}

export async function getBrowserSettings(
	config: BrowserConfig,
): Promise<TBrowserSettings> {
	// Viewport
	let viewPort = VIEW_PORT;
	if (config.viewport) {
		viewPort = config.viewport;
	}

	return {
		isDebug: config.isDebug ? config.isDebug : false,
		viewport: viewPort,
	};
}
