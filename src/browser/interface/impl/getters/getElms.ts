import { Browser, Page } from 'puppeteer';
import { GetElmsType } from '../../types';
import { segmentDOM } from '../../../../webFuncs/segmentDOM';
import { processElms } from '../../../../webFuncs/processElms';
import { simplifyDOM } from '../../../../webFuncs/simplifyDOM';
import { BrowserConfig } from '../../../../apis/browsers-cmgr';
import { GhostCursor } from 'ghost-cursor';
import { configureGhostCursor } from '../../ghostCursor';
import { getCurrentPage } from '../../../pages';

export interface IBody {
    type : GetElmsType;
    config: BrowserConfig
    viewPort: {
        width: number;
        height: number;
    };
    fullPage?: boolean;
    elms?: any;   
}

export default async function execute(
    page: Page, 
    puppeteerBrowser:Browser, 
    cursor:GhostCursor,
    body: IBody
) {
	if (body.type == GetElmsType.BySegmentation) {
		let elms = await page.evaluate(segmentDOM, [
			body.viewPort.width,
			body.viewPort.height,
		]);

		let waitTimeout = 30000;
		let waitFor = 1000;
		while (true) {
			let wordCount = 0;
			let waitCount = 0;
			let fullText = '';
			for (let i = 0; i < elms[2].length; i++) {
				let elm = elms[2][i];
				if (elm.text && elm.text !== '' && elm.text.trim() !== '') {
					// check if text is not just numbers
					if (/[a-zA-Z]/.test(elm.text)) {
						fullText += ' ' + elm.text;
					}
				}
			}
			fullText = fullText.toLowerCase();
			wordCount = fullText.split(' ').length;

			let listOfWords = [
				'loading',
				'please wait',
				'processing',
				'fetching',
				'retrieving',
				'initializing',
				'preparing',
				'syncing',
				'updating',
				'uploading',
				'downloading',
				'waiting',
				'connecting',
				'finalizing',
				// "Refreshing",
				'compiling',
				// "Executing",
				// "Searching",
				// "Submitting",
				'saving',
				// "Generating",
				'checking',
			];

			for (let word of listOfWords) {
				if (fullText.includes(word)) waitCount++;
			}

			// length 1 ==> overlay
			// length 0 ==> blank page
			if (
				waitCount / wordCount > 0.2 ||
				elms[2].length == 0 ||
				elms[2].length == 1
			) {
				await (async (delay) =>
					new Promise((resolve) => setTimeout(resolve, delay)))(
					waitFor,
				);
				page = (await getCurrentPage(puppeteerBrowser, body.config))
					.page;
				if (body.config.ghostCursor) {
					cursor = await configureGhostCursor(
						page,
						body.config.cursorConfig,
					);
				}

				elms = await page.evaluate(segmentDOM, [
					body.viewPort.width,
					body.viewPort.height,
				]);

				waitTimeout -= waitFor;
				if (waitTimeout <= 0) break;
				else continue;
			} else break;
		}
		
        return { elms: elms }
	} else if (body.type == GetElmsType.BySimplifyingDom) {
		// console.log('TIME 2 :', (new Date().getTime() - startTime) / 1000);

		var fullPageBBox = null;

		if (
			typeof body.fullPage != 'undefined' &&
			body.fullPage == true
		) {
			await page.evaluate(() => {
				document.body.style.overflow = 'hidden';
			});

			fullPageBBox = await page.evaluate(() => ({
				x: 0,
				y: 0,
				width: document.documentElement.scrollWidth,
				height: document.documentElement.scrollHeight,
			}));
			console.log('fullPageBBox', fullPageBBox);

			let totalHeight = await page.evaluate(
				() => document.documentElement.scrollHeight,
			);
			const currentViewportWidth = await page.evaluate(() => {
				return window.innerWidth;
			});

			if (totalHeight > 16384) {
				totalHeight = 16384;
			}

			await page.setViewport({
				width: currentViewportWidth,
				height: totalHeight,
			});
			//delay 500 ms
			await new Promise((resolve) => setTimeout(resolve, 500));

			// scroll to the top
			await page.evaluate(() => {
				window.scrollTo(0, 0);
			});
		}

		// let elms = await page.evaluate(simplifyDOM, fullPageBBox)

		// console.log('TIME 2a :', (new Date().getTime() - startTime) / 1000);

		async function tryEvaluate(
			page,
			simplifyDOM,
			fullPageBBox,
			attempts = 3,
		) {
			try {
				console.log('page', page);

				// Attempt to run the page.evaluate() function

				//console.log(
				//	'TIME 2a1 :',
				//	(new Date().getTime() - startTime) / 1000,
				//);
				console.log('before evaluate :');
				//let elms = await page.evaluate(simplifyDOM, fullPageBBox);
				const result = await Promise.race([page.evaluate(simplifyDOM, fullPageBBox, true), new Promise((_, reject) => setTimeout(() => reject(new Error('Evaluation timed out')), 20000))]);
				console.log('after evaluate :');
				//console.log(
				//	'TIME 2a2 :',
				//	(new Date().getTime() - startTime) / 1000,
				//);

				return result; // Return the result if successful
			} catch (error) {
				console.error('Error evaluating script:', error);

				// Decrease the attempts left
				attempts--;

				// If there are no attempts left, throw the error
				if (attempts <= 0) {
					throw error;
				}

				// Optional: Wait a bit before retrying (e.g., 500ms)
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// If error occurs and there are attempts left, try again
				return tryEvaluate(page, simplifyDOM, fullPageBBox, attempts);
			}
		}

		let scrollContainers;
		let elms;
		try {
			const result = await tryEvaluate(page, simplifyDOM, fullPageBBox);
			elms = result[0];
			scrollContainers = result[1];
			//console.log('TIME 2b :', (new Date().getTime() - startTime) / 1000);

			console.log('elms.length', elms.length);
		} catch (error) {
			// Handle the case where all retries have failed
			console.error('Failed after retries:', error);
		}

		// let elms = await page.evaluate( simplifyDOM, null)

		let waitTimeout = 30000;
		let waitFor = 1000;
		while (true) {
			console.log('TIME 2cz :');

			let wordCount = 0;
			let waitCount = 0;
			let fullText = '';
			for (let i = 0; i < elms.length; i++) {
				let elm = elms[i];
				if (elm.text && elm.text !== '' && elm.text.trim() !== '') {
					// check if text is not just numbers
					if (/[a-zA-Z]/.test(elm.text)) {
						fullText += ' ' + elm.text;
					}
				}
			}
			fullText = fullText.toLowerCase();
			wordCount = fullText.split(' ').length;

			for (let word of [
				'loading',
				'please wait',
				'loading please wait',
			]) {
				if (fullText.includes(word)) waitCount++;
			}

			// length 1 ==> overlay
			// length 0 ==> blank page
			if (
				waitCount / wordCount > 0.25 ||
				elms.length == 0 ||
				elms.length == 1
			) {
				// if (waitCount / wordCount > 0.25 || elms.length == 0) {
				await (async (delay) =>
					new Promise((resolve) => setTimeout(resolve, delay)))(
					waitFor,
				);
				page = (await getCurrentPage(puppeteerBrowser, body.config))
					.page;
				if (body.config.ghostCursor) {
					cursor = await configureGhostCursor(
						page,
						body.config.cursorConfig,
					);
				}
				// elms = await page.evaluate( segmentDOM, [body.viewPort.width, body.viewPort.height])
				const result = await page.evaluate(simplifyDOM, fullPageBBox, true);
				elms = result[0];
				scrollContainers = result[1];

				// console.log('simplifyDOM', simplifyDOM);
				console.log('elms.length', elms.length);

				waitTimeout -= waitFor;
				if (waitTimeout <= 0) break;
				else continue;
			} else break;
		}

		console.log('position: fgaslops');

		return { elms, scrollContainers }
	} else if (body.type == GetElmsType.ByCoords) {
		if (!body.elms) {
			return {
				code: 'Missing_Elms',
				message: 'missing elms',
			}
		} else {
			let elms = [];
			elms = await page.evaluate(processElms, body.elms);
			if (elms) {
				let nonNulls = [];
				for (let elm of elms) {
					if (elm) nonNulls.push(elm);
				}
				elms = nonNulls;
			}
			return { elms: elms }
		}
	} else if (body.type == GetElmsType.BySnapshot) {
		// Get the snapshot
		let cdp = await page.target().createCDPSession();
		let snapshot = await cdp.send('DOMSnapshot.captureSnapshot', {
			computedStyles: [],
			includeDOMRects: true,
			includePaintOrder: true,
		});

		return { snapshot: snapshot }
	} else {
		return {
			code: 'Invalid_Command',
			message: 'Invalid GetElms type',
		}
	}
}
