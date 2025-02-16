import { Browser, Page } from 'puppeteer';
import { BrowserConfig } from '../../apis/browsers-cmgr';
import { getBrowserSettings, VIEW_PORT } from '../';
import { attachDebuggers } from '../debug';
import sharp from 'sharp';

const ATTEMPT_DELAY = 500;
const MAX_ATTEMPTS = 3;
const SCREENSHOT_TIMEOUT = 60000;
const timeout = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

export async function getPageCount(browser: Browser): Promise<number> {
	let pages: Page[];
	for (let i = 0; i < MAX_ATTEMPTS; i++) {
		try {
			pages = await browser.pages();
			break;
		} catch (e) {
			if (i == MAX_ATTEMPTS - 1) {
				throw e;
			}
			await new Promise((resolve) => setTimeout(resolve, ATTEMPT_DELAY));
		}
	}

	return pages.length;
}

export async function getCurrentPage(
	browser: Browser,
	config: BrowserConfig | undefined,
): Promise<{ page: Page; index: number; pageCount: number }> {
	let pages: Page[];
	for (let i = 0; i < MAX_ATTEMPTS; i++) {
		try {
			pages = await browser.pages();
			console.log("Connected to browser at attempt", i)
			break;
		} catch (e) {
			if (i == MAX_ATTEMPTS - 1) {
				throw e;
			}
			await new Promise((resolve) => setTimeout(resolve, ATTEMPT_DELAY));
		}
	}

	let currIndex = 0;
	for (const page of pages) {
		const isFocused = await page.evaluate(() => document.hasFocus());
		if (isFocused) {
			break;
		}

		currIndex++;
	}

	// Apply settings to the page
	try {
		if (config) {
			const settings = await getBrowserSettings(config);

			// Attempt to access the page and perform a simple operation to check its validity
			console.log("Setting viewport for page", currIndex)
			await pages[currIndex].setViewport(
				settings ? settings.viewport : VIEW_PORT,
			);
			console.log("Set viewport for page", currIndex)
		}
	} catch (error) {
	}

	if (config && config.isDebug) {
		await attachDebuggers(pages[currIndex]);
	}

	return { page: pages[currIndex], index: currIndex, pageCount: pages.length };
}

export async function getPageAtIndex(
	browser: Browser,
	config: BrowserConfig | undefined,
	atIndex: number,
): Promise<{ page: Page; index: number }> {
	let pages: Page[];
	for (let i = 0; i < MAX_ATTEMPTS; i++) {
		try {
			pages = await browser.pages();
			break;
		} catch (e) {
			if (i == MAX_ATTEMPTS - 1) {
				throw e;
			}
			await new Promise((resolve) => setTimeout(resolve, ATTEMPT_DELAY));
		}
	}

	if (atIndex >= pages.length) {
		throw new Error('Page Index out of bounds');
	}

	// Apply settings to the page
	try {
		if (config) {
			const settings = await getBrowserSettings(config);

			// Attempt to access the page and perform a simple operation to check its validity
			await pages[atIndex].setViewport(
				settings ? settings.viewport : VIEW_PORT,
			);
		}
	} catch (error) {
	}

	if (config && config.isDebug) {
		await attachDebuggers(pages[atIndex]);
	}

	return { page: pages[atIndex], index: atIndex };
}

export async function takePageScreenshot(
	page: Page,
	config: BrowserConfig,
	fullPage: boolean,
	type: 'png' | 'jpeg' = 'png',
): Promise<string> {
	const MAX_SIZE_PX = 16384;
	const MAX_ALLOWED_HEIGHT = 50000;
	let factor = 0;
	let attempts = 0;
	let base64Image: string | null = null;

	console.log('Taking screenshot');
	while (attempts < MAX_ATTEMPTS) {
		try {
			let timeoutOccurred = false;
			console.log(`Capturing screenshot at attempt: ${attempts}`);

			if (fullPage) {
				const pageHeight = await page.evaluate(
					() => document.documentElement.scrollHeight,
				);
				const deviceScaleFactor =
					page.viewport()?.deviceScaleFactor || 1;
				const scaledHeight = pageHeight * deviceScaleFactor;
				const totalHeight = Math.min(scaledHeight, MAX_ALLOWED_HEIGHT);

				if (totalHeight <= MAX_SIZE_PX) {
					base64Image = await Promise.race([
						page.screenshot({
							optimizeForSpeed: true,
							encoding: 'base64',
							type,
							fullPage: true,
						}),
						timeout(SCREENSHOT_TIMEOUT * (1 + factor)).then(() => {
							timeoutOccurred = true;
							return null;
						}),
					]);
				} else {
					// Take multiple screenshots up to the maximum allowed height
					const viewport = page.viewport()!;
					const deviceScaleFactor = viewport.deviceScaleFactor || 1;
					const width = viewport.width * deviceScaleFactor;

					const screenshots: Buffer[] = [];
					const screenshotPromises = [];
					let currentYPosition = 0;

					while (currentYPosition < totalHeight) {
						const remainingHeight = totalHeight - currentYPosition;
						const clipHeight = Math.min(
							MAX_SIZE_PX,
							remainingHeight,
						);

						const screenshotPromise = page.screenshot({
							optimizeForSpeed: true,
							encoding: 'binary',
							type,
							clip: {
								x: 0,
								y: currentYPosition / deviceScaleFactor,
								width: viewport.width,
								height: clipHeight / deviceScaleFactor,
							},
						});

						screenshotPromises.push(screenshotPromise);
						currentYPosition += clipHeight;
					}

					const screenshotBuffers = await Promise.all(
						screenshotPromises,
					);
					screenshots.push(
						...screenshotBuffers.map((buf) => Buffer.from(buf)),
					);

					// Stitch images together
					let currentHeight = 0;
					const compositeOperations = [];

					for (const screenshot of screenshots) {
						const img = sharp(screenshot);
						const metadata = await img.metadata();
						const imgHeight = metadata.height!;

						compositeOperations.push({
							input: screenshot,
							top: currentHeight,
							left: 0,
						});

						currentHeight += imgHeight;

						// Stop if we've reached the maximum allowed height
						if (
							currentHeight >=
							MAX_ALLOWED_HEIGHT / deviceScaleFactor
						) {
							break;
						}
					}

					const finalHeight = Math.min(
						currentHeight,
						MAX_ALLOWED_HEIGHT,
					);

					const stitchedImage = sharp({
						create: {
							width: width,
							height: finalHeight,
							channels: 4,
							background: { r: 255, g: 255, b: 255, alpha: 0 },
						},
					}).composite(compositeOperations);

					// Apply compression based on image type
					if (type === 'jpeg') {
						stitchedImage.jpeg({ quality: 70 });
					} else {
						stitchedImage.png({ compressionLevel: 9 });
					}

					const stitchedImageBuffer = await stitchedImage.toBuffer();

					base64Image = stitchedImageBuffer.toString('base64');
				}
			} else {
				// Not fullPage
				base64Image = await Promise.race([
					page.screenshot({
						optimizeForSpeed: true,
						encoding: 'base64',
						type,
						fullPage: false,
					}),
					timeout(SCREENSHOT_TIMEOUT * (1 + factor)).then(() => {
						timeoutOccurred = true;
						return null;
					}),
				]);
			}

			if (timeoutOccurred) {
				throw new Error('Screenshot timeout');
			}
			console.log(`Captured screenshot at attempt: ${attempts}`);

			// Fix the issue with the scroll bar being hidden after taking the screenshot
			await page.evaluate(() => {
				document.body.style.overflow = 'auto';
			});

			break;
		} catch (e) {
			factor += 0;
		}

		attempts++;
	}

	if (base64Image) return base64Image;
	else throw new Error('Failed to capture screenshot');
}

export async function customScreenshot(
	page: Page,
	x: number,
	y: number,
	width: number,
	height: number,
): Promise<string> {
	// Capture the screenshot and return it
	return await page.screenshot({
		optimizeForSpeed: true,
		encoding: 'base64',
		clip: {
			x: x,
			y: y,
			width: width,
			height: height,
		},
	});
}
