//Imports
import { Browser, Page, ScreenshotOptions } from 'puppeteer';
import sharp from 'sharp';
import { getCurrentPage, getPageAtIndex } from '../';
import { Logger } from 'pino';
const pixelmatch = require('pixelmatch');
const PNG = require('pngjs').PNG;

const RESIZE_PERCENTAGE = 50;
const SCREENSHOT_TIMEOUT = 1000 // 3 seconds

const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createBlankImageBuffer = () => {
	// Return a blank image using sharp
	return sharp({
		create: {
			width: 800,
			height: 600,
			channels: 3,
			background: { r: 0, g: 0, b: 0 },
		},
	})
		.jpeg({ quality: 50 })
		.toBuffer();
};

async function captureAndResizeScreenshot(page: Page, settings: ScreenshotOptions, factor: number = 0, canFail = true) {
	console.log("captureAndResizeScreenshot")
	let timeoutOccurred = false;
	const screenshotBuffer = await Promise.race([
		page.screenshot({
			...settings,
			type: 'jpeg',
			quality: 50,
		}),
		timeout(SCREENSHOT_TIMEOUT * (1 + factor)).then(() => {
			timeoutOccurred = true;
			return createBlankImageBuffer();
		}),
	]);

	console.log("After aptureAndResizeScreenshot")
	if (timeoutOccurred) {
		console.log('Screenshot timed out');
		if (!canFail) {
			throw new Error('Screenshot timed out');
		}
	}

	const finalBuffer = screenshotBuffer

	let resizedBuffer;
	let attempts = 0;
	const maxAttempts = 3;
	const sharpTimeout = 5000; // 5 seconds

	console.log("Before sharp resize")
	while (attempts < maxAttempts) {
		try {
			resizedBuffer = await Promise.race([
				sharp(finalBuffer)
					.metadata()
					.then(metadata => {
						const width = Math.round(metadata.width * (1 - (RESIZE_PERCENTAGE / 100)));
						const height = Math.round(metadata.height * (1 - (RESIZE_PERCENTAGE / 100)));

						return sharp(screenshotBuffer)
							.resize(width, height)
							.png()
							.toBuffer();
					}),
				timeout(sharpTimeout).then(() => {
					throw new Error('Sharp resize operation timed out');
				})
			]);
			break; // Success, exit retry loop
		} catch (error) {
			attempts++;
			console.log(`Sharp resize attempt ${attempts} failed:`, error.message);
			
			if (attempts >= maxAttempts) {
				throw new Error(`Sharp resize failed after ${maxAttempts} attempts: ${error.message}`);
			}
			
			// Short delay before retry
			await timeout(100);
		}
	}
	console.log("After sharp resize")
	return resizedBuffer;
}

const splitImage = async (imageBuffer: Buffer, rows: number, cols: number) => {
	const image = sharp(imageBuffer);
	const { width, height } = await image.metadata();
	const secWidth = Math.floor(width / cols);
	const secHeight = Math.floor(height / rows);
	const extractPromises = [];

	for (let i = 0; i < rows; i++) {
		for (let j = 0; j < cols; j++) {
			const left = j * secWidth;
			const top = i * secHeight;
			const extractWidth = j === cols - 1 ? width - left : secWidth;
			const extractHeight = i === rows - 1 ? height - top : secHeight;
			const extractPromise = sharp(imageBuffer)
				.extract({
					left,
					top,
					width: extractWidth,
					height: extractHeight,
				})
				.png()
				.toBuffer()
				.then((sectionBuffer) => PNG.sync.read(sectionBuffer))
				.catch((error) => {
					console.error(
						`Error extracting section at row ${i}, col ${j}: ${error.message}`,
					);
					return null; // Return null in case of error
				});

			extractPromises.push(extractPromise);
		}
	}

	const sections = await Promise.all(extractPromises);
	const validSections = sections.filter((section) => section !== null);

	console.log('No of sections: ', validSections.length);
	return validSections;
};

const compareSections = async (
	imageBuffer1: Buffer,
	imageBuffer2: Buffer,
	rows: number,
	cols: number,
) => {
	const sections1 = await splitImage(imageBuffer1, rows, cols);
	const sections2 = await splitImage(imageBuffer2, rows, cols);

	const comparisons = sections1.map((section1, idx) => {
		const section2 = sections2[idx];

		// Return a promise for each comparison so that we can use Promise.all for parallel processing
		return new Promise((resolve) => {
			const { width, height } = section1;
			const threshold = 1;
			const mismatchedPixels = pixelmatch(
				section1.data,
				section2.data,
				null,
				width,
				height,
				{ threshold: 0.1 },
			);
			const perChange = (mismatchedPixels / (width * height)) * 100;

			// console.log({ mismatchedPixels, perChange })
			resolve(perChange <= threshold);
		});
	});

	const results = await Promise.all(comparisons);
	const mismatchedSections = results.filter(
		(result) => result === false,
	).length;
	return mismatchedSections;
};

export async function awaitPageTillLoaded(
	logger: Logger,
	headers: Record<string, string>,
	browser: Browser,
	pageIndex: number,
	pullDuration = 100,
	timeout = 10000,
	settings = { encoding: 'binary', fullPage: false },
	attempts = 2,
	attemptDelay = 200,
) {
	let page: Page | null = null;
	let currPageIndex: number = 0;
	let factor = 0

	for (let i = 0; i < attempts; i++) {
		try {
			settings = { encoding: 'binary', fullPage: false };
			const browserTab = await getPageAtIndex(
				logger,
				headers,
				browser, 
				null, 
				pageIndex
			);

			page = browserTab.page;
			currPageIndex = browserTab.index;
			console.log('currPageIndex: ' + currPageIndex, page.url(), page);
			//page.on('dialog', async (dialog) => {
			//	await dialog.dismiss()
			//})

			// InitializeFirstImage
			let currPage = await captureAndResizeScreenshot(
				page,
				settings as ScreenshotOptions,
				factor,
				false
			);

			await new Promise((r) => setTimeout(r, pullDuration));

			console.log('awaitPage 1');
			// Image Should not be full white
			let tolerance = 98;
			let attemptsBeforeBreak = 10;
			let attempts1 = 0;

			console.log('START INSIDE: ', i);
			let startTime = new Date().getTime();
			startTime = new Date().getTime();

			console.time('WHITE PIXEL COUNT LOOP');
			while (true) {
				console.time('WHITE PIXEL COUNT LOOP - ITERATION');
				let pCount = 0;
				let wCount = 0;

				currPage = await captureAndResizeScreenshot(
					page,
					settings as ScreenshotOptions,
					factor,
				);
				let img = PNG.sync.read(currPage);

				// Calc the number of white pixels
				let { width, height } = img;
				console.log({ width, height });
				for (let y = 0; y < height; y++) {
					for (let x = 0; x < width; x++) {
						const pos = (y * width + x) * 4;
						let r = img.data[pos + 0];
						let g = img.data[pos + 1];
						let b = img.data[pos + 2];

						if (r == 255 && g == 255 && b == 255) {
							wCount++;
						}

						pCount++;
					}
				}
				let perWhite = (wCount / pCount) * 100;

				attemptsBeforeBreak--;

				console.log(
					'attempt: ' +
					attemptsBeforeBreak +
					' perWhite: ' +
					perWhite +
					' pCount: ' +
					pCount +
					' wCount: ' +
					wCount,
				);
				console.timeEnd('WHITE PIXEL COUNT LOOP - ITERATION');
				if (perWhite > tolerance && attemptsBeforeBreak > 0) {
					await new Promise((r) => setTimeout(r, 1000));
					page = (await getPageAtIndex(
						logger,
						headers,
						browser,
						null,
						currPageIndex,
					)).page;

					continue;
				} else break;
			}
			console.timeEnd('WHITE PIXEL COUNT LOOP');

			const BANNED_CLASSES = [
				'carousel',
				'carousel-container',
				'slick-slider',
				// "swiper-wrapper",
				// "swiper-container",
				'flickity-viewport',
				'owl-carousel',
				'glider',
				'splide__list',
				'slidesjs-container',
				'siema',
				'glide__track',
				'jssor-slider',
				'flex-viewport',
				'vegas-container',
				'slides-container',
				'ws_images',
				'lSSlideOuter',
				'fullpage-wrapper',
				'sequence-canvas',
				'bx-viewport',
				'nivoSlider',
				'royalSlider',
				'sp-slides',
				'reveal',
				'roundSlider',
				'pswp',
				'nanoGallery',
				'chocolat-wrapper',
				'lg-inner',
				'blueimp-gallery',
				'unite-gallery',
				'rev_slider_wrapper',
				'ls-container-full-width',
				'masterslider',
				'sa-container',
				'cycle-slideshow',
				'pgwSlider',
				'bjqs-markers',
				'unslider-wrap',
				'slides',
				'turn-page-wrapper',
				'scroller-viewport',
				'slidesjs-container',
				'anyslider-wrapper',
				'jssor-slider',
				'rtp-slider',
				'lean-slider-slide',
				'ws_list',
				'iis-slide-container',
				'slidr',
				'sd2-content-wrapper',
			];

			// Wait for html
			await page.waitForSelector('html');
			// i want code to randomly 1 every 10 times go to the url google.com
			/*       let random = Math.floor(Math.random() * 5)
			if(random === 1) {
	  
			  console.log('THROW ERROR')
			  throw new Error("Execution context was destroyed, most likely because of a navigation.")
	  
			} */

			// Remove them all
			console.time('REMOVE BANNED CLASSES');
			await page.evaluate((classes: string[]) => {
				const addCanvasOverlay = (element: HTMLElement) => {
					const rect = element.getBoundingClientRect();
					const canvas = document.createElement('canvas');
					canvas.width = rect.width + 1;
					canvas.height = rect.height + 1;
					canvas.style.position = 'fixed';
					canvas.style.left = `${rect.left}px`;
					canvas.style.top = `${rect.top}px`;
					canvas.style.zIndex = '9999';
					canvas.style.backgroundColor = 'black';
					canvas.className = '___overlayCanvas';
					document.body.appendChild(canvas);
				};
				const selector = classes
					.map((className) => `.${className}`)
					.join(',');
				const elms = document.querySelectorAll(selector);
				for (let i = 0; i < elms.length; i++) {
					let elm = elms[i] as HTMLElement;
					try {
						addCanvasOverlay(elm);
					} catch (e) { }
				}

				// Videos
				let videos = document.getElementsByTagName('video');
				for (let i = 0; i < videos.length; i++) {
					try {
						addCanvasOverlay(videos[i]);
					} catch (e) { }
				}

				// Images
				let imgs = document.getElementsByTagName('img');
				for (let i = 0; i < imgs.length; i++) {
					if (imgs[i].width > 50) {
						addCanvasOverlay(imgs[i]);
					}
				}

				// Background image classes:
				const elemesWithBg = Array.from(
					document.querySelectorAll('*'),
				).filter((el) => {
					const style = window.getComputedStyle(el);
					const hasBackgroundImage = style.backgroundImage !== 'none';

					// Only find ones with bg image
					if (!hasBackgroundImage) {
						return false;
					}

					const rect = el.getBoundingClientRect();
					const inViewport =
						rect.top >= 0 &&
						rect.left >= 0 &&
						rect.bottom <=
						(window.innerHeight ||
							document.documentElement.clientHeight) &&
						rect.right <=
						(window.innerWidth ||
							document.documentElement.clientWidth);

					// Visible and not hidden
					if (
						!inViewport ||
						style.visibility === 'hidden' ||
						style.opacity === '0'
					) {
						return false;
					}

					// Not obscured by another elmenet
					const centerX = rect.left + rect.width / 2;
					const centerY = rect.top + rect.height / 2;
					const topElement = document.elementFromPoint(
						centerX,
						centerY,
					);
					const isForeground =
						el.contains(topElement) || topElement === el;

					return isForeground;
				});
				elemesWithBg.forEach((el) =>
					addCanvasOverlay(el as HTMLElement),
				);
			}, BANNED_CLASSES);
			console.timeEnd('REMOVE BANNED CLASSES');

			// Main loop
			console.time('MAIN LOOP');
			while (true) {
				let attempts2 = 0;
				let noChange = 0;

				console.log(
					'attemps2 ' +
					attempts2 +
					' noChange: ' +
					noChange +
					' timeout: ' +
					timeout +
					' pullDuration: ' +
					pullDuration,
				);

				/////////////////////////////////////// Timeout handling ///////////////////////////////////////////
				if (timeout <= 0) {
					// Function to remove all canvases
					await page.evaluate(() => {
						const canvases =
							document.querySelectorAll('.___overlayCanvas');
						canvases.forEach((canvas) => canvas.remove());
					});
					throw new Error('Timeout Reached');
				}

				// console.log('TIME INSIDE 8b (ADD BACK OPACITY):', (new Date().getTime() - startTime) / 1000);
				// startTime = new Date().getTime()

				/////////////////////////////////////// Main inner loop for pixel compare ///////////////////////////////////////////
				let prvPage = await captureAndResizeScreenshot(
					page,
					settings as ScreenshotOptions,
					factor,
				);
				await new Promise((r) => setTimeout(r, pullDuration));
				while (true) {
					// Check if the page has changed
					let prvPage2 = await captureAndResizeScreenshot(
						page,
						settings as ScreenshotOptions,
						factor,
					);
					await new Promise((r) => setTimeout(r, pullDuration));
					console.time('INNER LOOP - PIXEL MATCH');
					let img1 = PNG.sync.read(prvPage);
					let img2 = PNG.sync.read(prvPage2);
					let { width, height } = img1;

					let mismatchedPixels = pixelmatch(
						img1.data,
						img2.data,
						null,
						width,
						height,
						{ threshold: 0.1 },
					);
					let perChange = (mismatchedPixels / (width * height)) * 100;

					console.log(
						'mismatchedPixels: ' +
						mismatchedPixels +
						' perChange: ' +
						perChange,
					);
					console.timeEnd('INNER LOOP - PIXEL MATCH');
					let threshold = 1;

					// TODO: Compare sections appraoch, commented for now as it is slower than direct matching
					// console.time('COMPARE SECTIONS')
					// const rows = 20;
					// const cols = 10;
					// const totalSections = rows * cols;
					// const mismatchedSections = await compareSections(prvPage, prvPage2, rows, cols)
					// const perChange = (mismatchedSections / totalSections * 100)
					// console.log('mismatchedPixels: ' + mismatchedSections + ' perChange: ' + perChange)
					// console.timeEnd('COMPARE SECTIONS')
					// let threshold = 5

					if (perChange <= threshold) {
						noChange = noChange + 1;
						// If the page has not changed for 3 consecutive times
						if (noChange >= 3) {
							prvPage = prvPage2;
							console.log('set attempts to 0');
							attempts2 = 0;
							break;
						}
					} else noChange = 0;

					console.log('attempts2:: ' + attempts2);

					timeout = timeout - pullDuration;
					attempts2++;
					if (attempts2 >= 5) break;
					// if attempts2 is >=5 then break from this loop and the parent loop
				}

				/////////////////////////////////////// Attempts exceed cases ///////////////////////////////////////////
				if (attempts2 >= 3) {
					attempts1++;
					if (attempts1 >= 2) break;

					continue;
				} else {
					console.time('PIXEL MATCH 2');
					let img1 = PNG.sync.read(currPage);
					let img2 = PNG.sync.read(prvPage);
					let { width, height } = img1;

					let mismatchedPixels = pixelmatch(
						img1.data,
						img2.data,
						null,
						width,
						height,
						{ threshold: 0.1 },
					);
					let perChange = (mismatchedPixels / (width * height)) * 100;
					let threshold = 1;

					try {
						console.time('REMOVE CANVAS');
						// Function to remove all canvases
						await page.evaluate(() => {
							const canvases =
								document.querySelectorAll('.___overlayCanvas');
							canvases.forEach((canvas) => canvas.remove());
						});
						console.timeEnd('REMOVE CANVAS');
					} catch (e) {
						// return false

						// sometimes the page changes, like on replit login page, so we need to check if the page has changed
						// to prevent error: "Execution context was destroyed, most likely because of a navigation."


						console.log('ERROR WITH LOADING PAGE, RESETTING PAGE');
						const newPage = await getCurrentPage(
							logger,
							headers,
							browser,
							null,
						);

						currPageIndex = newPage.index;
						page = newPage.page;
						//page.on('dialog', async (dialog) => {
						//	await dialog.dismiss()
						//})
						continue;
					}

					console.timeEnd('PIXEL MATCH 2');
					// FOR DEBUGGING if the answer is YES, DRAW BOX Around the change??
					return perChange > threshold;
				}
			}
			console.timeEnd('MAIN LOOP');
			// Break out
			break;
		} catch (error: unknown) {
			factor = factor + 0.25
			console.log('ERROR WITH NAVIGATION, RESETTING PAGE 1', error);

			console.time('REMOVE CANVAS');
			// Function to remove all canvases
			await page.evaluate(() => {
				const canvases =
					document.querySelectorAll('.___overlayCanvas');
				canvases.forEach((canvas) => canvas.remove());
			});
			console.timeEnd('REMOVE CANVAS');

			// If no more attempts, break with error
			if (i === attempts - 1)
				throw new Error(
					'Execution context was destroyed, most likely because of a navigation.',
				);

			// Context was destroyed, re-run
			await new Promise((r) => setTimeout(r, attemptDelay));
		}
	}

	if (page) {
		console.time('REMOVE CANVAS');
		// Function to remove all canvases
		await page.evaluate(() => {
			const canvases =
				document.querySelectorAll('.___overlayCanvas');
			canvases.forEach((canvas) => canvas.remove());
		});
		console.timeEnd('REMOVE CANVAS');
	}
}

export async function waitTillNotBlankPage(page: Page, timeout = 5000) {
	while (page.url() === 'about:blank') {
		await new Promise((r) => setTimeout(r, 100));
		timeout -= 100;
		if (timeout <= 0) break;
	}
}

export async function awaitPageLegacy(
	logger: Logger,
	headers: Record<string, string>,
	browser: Browser,
	pullDuration = 100,
	timeout = 10000,
	settings = { encoding: 'binary', fullPage: false },
	attempts = 2,
	attemptDelay = 200,
) {
	for (let i = 0; i < attempts; i++) {
		try {
			settings = { encoding: 'binary', fullPage: false };
			/* if(settings.clip.x < 0) { 
		  settings.clip.x = 0
		}
  
		if(settings.clip.y < 0) {
		  settings.clip.y = 0
		} */

			console.log('awaitPage 0');

			let { page, index } = await getCurrentPage(
				logger,
				headers,
				browser,
				null,
			);
			let currPageIndex = index;

			// InitializeFirstImage
			let currPage = await page.screenshot(settings as ScreenshotOptions);

			/* 
		const viewportWidth = 1280;  // Example: your current viewport width
		const viewportHeight = 2400; // Example: your current viewport height
  
		const clipWidth = 1000;
		const clipHeight = 600;
  
		const clipSettings = {
		  x: (viewportWidth - clipWidth) / 2,
		  y: (viewportHeight - clipHeight) / 2,
		  width: clipWidth,
		  height: clipHeight
		};
  
		settings = {
		  encoding: "binary", 
		  fullPage: false,
		  clip: clipSettings, // This applies the clip area defined above
		}; */

			await new Promise((r) => setTimeout(r, pullDuration));

			console.log('awaitPage 1');
			// Image Should not be full white
			let tolerance = 98;
			let attemptsBeforeBreak = 10;

			let attempts1 = 0;

			console.log('START INSIDE: ', 0);
			var startTime = new Date().getTime();

			console.log(
				'TIME INSIDE 1 :',
				(new Date().getTime() - startTime) / 1000,
			);

			while (true) {
				let pCount = 0;
				let wCount = 0;

				console.log('settings: ', settings);

				console.log(
					'TIME INSIDE 1a :',
					(new Date().getTime() - startTime) / 1000,
				);
				currPage = await page.screenshot(settings as ScreenshotOptions);
				console.log(
					'TIME INSIDE 1b :',
					(new Date().getTime() - startTime) / 1000,
				);

				let img = PNG.sync.read(currPage);

				// Calc the number of white pixels
				let { width, height } = img;
				for (let y = 0; y < height; y++) {
					for (let x = 0; x < width; x++) {
						const pos = (y * width + x) * 4;
						let r = img.data[pos + 0];
						let g = img.data[pos + 1];
						let b = img.data[pos + 2];

						if (r == 255 && g == 255 && b == 255) {
							wCount++;
						}

						pCount++;
					}
				}

				console.log(
					'TIME INSIDE 2 :',
					(new Date().getTime() - startTime) / 1000,
				);

				let perWhite = (wCount / pCount) * 100;

				attemptsBeforeBreak--;

				console.log(
					'attempt: ' +
					attemptsBeforeBreak +
					' perWhite: ' +
					perWhite +
					' pCount: ' +
					pCount +
					' wCount: ' +
					wCount,
				);

				console.log(
					'TIME INSIDE 3 :',
					(new Date().getTime() - startTime) / 1000,
				);

				if (perWhite > tolerance && attemptsBeforeBreak > 0) {
					await new Promise((r) => setTimeout(r, 1000));
					page = (await getPageAtIndex(
						logger,
						headers,
						browser, 
						null, 
						currPageIndex)
					)
						.page;

					continue;

					console.log(
						'TIME INSIDE 4 :',
						(new Date().getTime() - startTime) / 1000,
					);

					continue;
				} else break;
			}

			const BANNED_CLASSES = [
				'carousel',
				'carousel-container',
				'slick-slider',
				// "swiper-wrapper",
				// "swiper-container",
				'flickity-viewport',
				'owl-carousel',
				'glider',
				'splide__list',
				'slidesjs-container',
				'siema',
				'glide__track',
				'jssor-slider',
				'flex-viewport',
				'vegas-container',
				'slides-container',
				'ws_images',
				'lSSlideOuter',
				'fullpage-wrapper',
				'sequence-canvas',
				'bx-viewport',
				'nivoSlider',
				'royalSlider',
				'sp-slides',
				'reveal',
				'roundSlider',
				'pswp',
				'nanoGallery',
				'chocolat-wrapper',
				'lg-inner',
				'blueimp-gallery',
				'unite-gallery',
				'rev_slider_wrapper',
				'ls-container-full-width',
				'masterslider',
				'sa-container',
				'cycle-slideshow',
				'pgwSlider',
				'bjqs-markers',
				'unslider-wrap',
				'slides',
				'turn-page-wrapper',
				'scroller-viewport',
				'slidesjs-container',
				'anyslider-wrapper',
				'jssor-slider',
				'rtp-slider',
				'lean-slider-slide',
				'ws_list',
				'iis-slide-container',
				'slidr',
				'sd2-content-wrapper',
			];

			// Wait for html
			await page.waitForSelector('html');

			console.log(
				'TIME INSIDE 5 :',
				(new Date().getTime() - startTime) / 1000,
			);

			// i want code to randomly 1 every 10 times go to the url google.com
			/*       let random = Math.floor(Math.random() * 5)
			  if(random === 1) {
		
				console.log('THROW ERROR')
				throw new Error("Execution context was destroyed, most likely because of a navigation.")
		
			  } */

			// Remove them all
			await page.evaluate((classes: string[]) => {
				const selector = classes
					.map((className) => `.${className}`)
					.join(',');
				const elms = document.querySelectorAll(selector);
				for (let i = 0; i < elms.length; i++) {
					let elm = elms[i] as HTMLElement;
					try {
						elm.style.opacity = '0';
					} catch (e) { }
				}
			}, BANNED_CLASSES);

			console.log(
				'TIME INSIDE 6 :',
				(new Date().getTime() - startTime) / 1000,
			);

			// Remove Videos: video
			await page.evaluate(() => {
				let videos = document.getElementsByTagName('video');
				for (let i = 0; i < videos.length; i++) {
					try {
						videos[i].style.opacity = '0';
					} catch (e) { }
				}
			});

			console.log(
				'TIME INSIDE 7 :',
				(new Date().getTime() - startTime) / 1000,
			);

			//  Temp remove images
			let indexes = await page.evaluate(() => {
				let imgs = document.getElementsByTagName('img');
				let indexes = [];
				for (let i = 0; i < imgs.length; i++) {
					if (imgs[i].width > 50) {
						let opacity = imgs[i].style.opacity;
						imgs[i].style.opacity = '0';
						indexes.push({ index: i, opacity: opacity });
					}
				}
				return indexes;
			});

			console.log(
				'TIME INSIDE 8 :',
				(new Date().getTime() - startTime) / 1000,
			);

			while (true) {
				let attempts2 = 0;
				let noChange = 0;

				console.log(
					'TIME INSIDE 8a :',
					(new Date().getTime() - startTime) / 1000,
				);

				console.log(
					'attemps2 ' +
					attempts2 +
					' noChange: ' +
					noChange +
					' timeout: ' +
					timeout +
					' pullDuration: ' +
					pullDuration,
				);

				if (timeout <= 0) {
					await page.evaluate(
						(indexes: { index: number; opacity: string }[]) => {
							let imgs = document.getElementsByTagName('img');

							for (let i of indexes) {
								imgs[i.index].style.opacity = i.opacity;
							}
						},
						indexes,
					);
					throw new Error('Timeout Reached');
				}

				console.log(
					'TIME INSIDE 8b :',
					(new Date().getTime() - startTime) / 1000,
				);

				let prvPage = await page.screenshot(
					settings as ScreenshotOptions,
				);
				await new Promise((r) => setTimeout(r, pullDuration));

				console.log(
					'TIME INSIDE 8c :',
					(new Date().getTime() - startTime) / 1000,
				);

				while (true) {
					console.log(
						'TIME INSIDE 8c1 :',
						(new Date().getTime() - startTime) / 1000,
					);

					// Check if the page has changed
					let prvPage2 = await page.screenshot(
						settings as ScreenshotOptions,
					);
					await new Promise((r) => setTimeout(r, pullDuration));

					let img1 = PNG.sync.read(prvPage);
					let img2 = PNG.sync.read(prvPage2);
					let { width, height } = img1;

					let mismatchedPixels = pixelmatch(
						img1.data,
						img2.data,
						null,
						width,
						height,
						{ threshold: 0.1 },
					);
					let perChange = (mismatchedPixels / (width * height)) * 100;

					console.log(
						'mismatchedPixels: ' +
						mismatchedPixels +
						' perChange: ' +
						perChange,
					);

					let threshold = 1;
					if (perChange <= threshold) {
						noChange = noChange + 1;
						// If the page has not changed for 3 consecutive times
						if (noChange >= 3) {
							prvPage = prvPage2;
							console.log('set attempts to 0');
							attempts2 = 0;
							break;
						}
					} else noChange = 0;

					console.log('attempts2:: ' + attempts2);

					timeout = timeout - pullDuration;
					attempts2++;
					if (attempts2 >= 5) break;
					// if attempts2 is >=5 then break from this loop and the parent loop
				}

				console.log(
					'TIME INSIDE 8d :',
					(new Date().getTime() - startTime) / 1000,
				);

				if (attempts2 >= 3) {
					console.log('continue');
					attempts1++;

					if (attempts1 >= 2) break;

					continue;
				} else {
					let img1 = PNG.sync.read(currPage);
					let img2 = PNG.sync.read(prvPage);
					let { width, height } = img1;

					let mismatchedPixels = pixelmatch(
						img1.data,
						img2.data,
						null,
						width,
						height,
						{ threshold: 0.1 },
					);
					let perChange = (mismatchedPixels / (width * height)) * 100;
					let threshold = 1;

					try {
						await page.evaluate(
							(indexes: { index: number; opacity: string }[]) => {
								let imgs = document.getElementsByTagName('img');

								for (let i of indexes) {
									imgs[i.index].style.opacity = i.opacity;
								}
							},
							indexes,
						);

						console.log(
							'TIME INSIDE 8e :',
							(new Date().getTime() - startTime) / 1000,
						);
					} catch (e) {
						// return false

						// sometimes the page changes, like on replit login page, so we need to check if the page has changed
						// to prevent error: "Execution context was destroyed, most likely because of a navigation."

						console.log('ERROR WITH LOADING PAGE, RESETTING PAGE');
						const newPage = await getCurrentPage(
							logger,
							headers,
							browser,
							null,
						);

						currPageIndex = newPage.index;
						page = newPage.page;
						continue;
					}

					// FOR DEBUGGING if the answer is YES, DRAW BOX Around the change??
					return perChange > threshold;
				}
			}
			console.log(
				'TIME INSIDE 9 :',
				(new Date().getTime() - startTime) / 1000,
			);

			// Break out
			break;
		} catch (error: unknown) {
			console.log('ERROR WITH NAVIGATION, RESETTING PAGE 1', error);

			/* if(error instanceof Error) {
		  // If error is not context was destroyed, break
		  if(error.message !== "Execution context was destroyed, most likely because of a navigation.") {
			throw error
		  }
		} */

			// If no more attempts, break with error
			if (i === attempts - 1)
				throw new Error(
					'Execution context was destroyed, most likely because of a navigation.',
				);

			// Context was destroyed, re-run
			await new Promise((r) => setTimeout(r, attemptDelay));
		}
	}
}
