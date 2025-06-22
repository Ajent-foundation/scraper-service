import { Browser, Page } from 'puppeteer';
import { GetElmsType } from '../../types';
import { segmentDOM } from '../../../../webFuncs/segmentDOM';
import { processElms } from '../../../../webFuncs/processElms';
import { simplifyDOM } from '../../../../webFuncs/simplifyDOM';
import { BrowserConfig } from '../../../../apis/browsers-cmgr';
import { GhostCursor } from 'ghost-cursor';
import { configureGhostCursor } from '../../ghostCursor';
import { getCurrentPage } from '../../../pages';
import { Logger } from 'pino';
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
    logger: Logger,
    headers: Record<string, string>,
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
				if (elm.text && elm.text !== '') {
					if(elm.text.trim() !== '') {
						// check if text is not just numbers
						if (/[a-zA-Z]/.test(elm.text)) {
							fullText += ' ' + elm.text;
						}
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
				page = (await getCurrentPage(
					logger,
					headers,
					puppeteerBrowser,
					body.config
				))
					.page;
				if (body.config && body.config.ghostCursor) {
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
			//let originalBodyOverflow = await page.evaluate(() => document.body.style.overflow);	
 			//await page.evaluate(() => {
 			//	document.body.style.overflow = 'hidden';
 			//});
 

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

			//await page.evaluate((originalBodyOverflow) => {
			//	document.body.style.overflow = originalBodyOverflow;
			//}, originalBodyOverflow);
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
				// console.log('page', page);

				// Attempt to run the page.evaluate() function

				//console.log(
				//	'TIME 2a1 :',
				//	(new Date().getTime() - startTime) / 1000,
				//);
				// console.log('before evaluate :');
				//let elms = await page.evaluate(simplifyDOM, fullPageBBox);
				const result = await Promise.race([page.evaluate(simplifyDOM, fullPageBBox, true), new Promise((_, reject) => setTimeout(() => reject(new Error('Evaluation timed out')), 20000))]);
				// console.log('after evaluate :');
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

			// console.log('elms.length', elms.length);
		} catch (error) {
			// Handle the case where all retries have failed
			console.error('Failed after retries:', error);
		}

		// let elms = await page.evaluate( simplifyDOM, null)

		let waitTimeout = 30000;
		let waitFor = 1000;
		while (true) {
			// console.log('TIME 2cz :');

			let wordCount = 0;
			let waitCount = 0;
			let fullText = '';
			if(elms) {
				for (let i = 0; i < elms.length; i++) {
						let elm = elms[i];
						if (elm.text && elm.text !== '' && elm.text.trim() !== '') {
						// check if text is not just numbers
						if (/[a-zA-Z]/.test(elm.text)) {
							fullText += ' ' + elm.text;
						}
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
				page = (await getCurrentPage(
					logger,
					headers,
					puppeteerBrowser,
					body.config
				))
					.page;
				if (body.config && body.config.ghostCursor) {
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
				// console.log('elms.length', elms.length);

				waitTimeout -= waitFor;
				if (waitTimeout <= 0) break;
				else continue;
			} else break;
		}

		/*
		// console.log('position: fgaslops');

		// Extract elements from iframes
		console.log('Finding and processing iframes...');
		const iframeHandles = await page.$$('iframe');
		console.log(`Found ${iframeHandles.length} iframes on the page`);
		
		let iframeElementsCount = 0;
		// Process each iframe
		for (let i = 0; i < iframeHandles.length; i++) {
			const iframe = iframeHandles[i];
			
			// Get iframe position and dimensions
			const iframePosition = await page.evaluate(frame => {
				const rect = frame.getBoundingClientRect();
				return {
					x: rect.x,
					y: rect.y,
					width: rect.width,
					height: rect.height
				};
			}, iframe);
			
			console.log(`Processing iframe #${i+1} at position (${iframePosition.x}, ${iframePosition.y})`);
			
			// Get the frame object
			const frame = await iframe.contentFrame();
			if (!frame) {
				console.log('Could not access iframe content (might be empty or restricted)');
				continue;
			}
			
			try {
				// Wait for iframe content to load
				await frame.waitForSelector('body', { timeout: 5000 }).catch(() => {
					console.log('Timeout waiting for body in iframe - continuing anyway');
				});
				
				// Get iframe source for reference
				const iframeSrc = await iframe.evaluate(frame => frame.src);
				
				// Debug: Check specifically for LI elements with anchors
				await frame.evaluate(() => {
					const listItems = document.querySelectorAll('li');
					if (listItems.length > 0) {
						console.log(`Checking ${listItems.length} LI elements directly in iframe...`);
						let liWithAnchors = 0;
						
						for (let i = 0; i < Math.min(listItems.length, 10); i++) {
							const li = listItems[i];
							const hasAnchor = li.querySelector('a') !== null;
							if (hasAnchor) {
								liWithAnchors++;
								const anchor = li.querySelector('a');
								const href = anchor.getAttribute('href');
								const text = li.innerText.trim();
								console.log(`LI element with text "${text}" contains anchor with href="${href}"`);
							}
						}
						
						console.log(`Found ${liWithAnchors} LI elements with anchors (sample of first 10)`);
					}
				});
				
				// Extract elements from the iframe
				const iframeResult = await frame.evaluate((iframePosition, iframeSrc) => {
					// The simplifyDOM function needs to be injected here for iframe processing
					// This is a simplification - the actual implementation should match simplifyDOM
					function processIframeElements(iframePosition) {
						const elements = [];
						let index = 0;
						
						function isElementVisible(element) {
							if (!element) return false;
							
							const style = window.getComputedStyle(element);
							
							if (style.display === 'none') return false;
							if (style.visibility === 'hidden') return false;
							if (parseFloat(style.opacity) === 0) return false;
							
							const rect = element.getBoundingClientRect();
							if (rect.width === 0 || rect.height === 0) return false;
							
							return true;
						}
						
						function isClickable(el) {
							try {
								// Check if the element itself is clickable
								const style = window.getComputedStyle(el);
								let hasClickEvent = (
									el.getAttribute('onclick') != null || 
									el.getAttribute('href') != null ||
									el.getAttribute('onmousedown') != null ||
									el.getAttribute('onmouseup') != null ||
									el.getAttribute('onkeydown') != null ||
									el.getAttribute('onkeyup') != null ||
									style.cursor === 'pointer'
								);
								
								if (hasClickEvent) return true;
								
								// Check if role is a clickable type
								const role = el.getAttribute('role');
								if (role && ['button', 'link', 'checkbox', 'menuitem', 'tab', 'radio'].includes(role)) {
									return true;
								}
								
								// Check if any child elements are clickable (especially for container elements)
								if (el.children && el.children.length > 0) {
									for (let i = 0; i < el.children.length; i++) {
										// Check direct child elements for <a> tags with href attributes
										const child = el.children[i];
										if (child.tagName === 'A' && child.getAttribute('href')) {
											return true;
										}
										
										// Check for button elements
										if (child.tagName === 'BUTTON') {
											return true;
										}
										
										// Recursively check other children
										if (isClickable(child)) {
											return true;
										}
									}
								}
								
								// As a fallback, check parent element
								if (el.parentElement) return isClickable(el.parentElement);
								
								return false;
							} catch (e) {
								return false;
							}
						}
						
						function isTriggerable(el) {
							try {
								// Check if the element itself is triggerable
								const style = window.getComputedStyle(el);
								let hasClickEvent = (
									el.getAttribute('onclick') != null || 
									el.getAttribute('href') != null ||
									el.getAttribute('onmousedown') != null ||
									el.getAttribute('onmouseup') != null ||
									el.getAttribute('onkeydown') != null ||
									el.getAttribute('onkeyup') != null ||
									style.cursor === 'pointer'
								);
								
								if (hasClickEvent) return true;
								
								// Check for input elements
								if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName)) {
									return true;
								}
								
								// Check for interactive roles
								const role = el.getAttribute('role');
								if (role && ['button', 'link', 'checkbox', 'menuitem', 'tab', 'radio', 'textbox', 'combobox'].includes(role)) {
									return true;
								}
								
								// Check child elements
								if (el.children && el.children.length > 0) {
									for (let i = 0; i < el.children.length; i++) {
										const child = el.children[i];
										if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(child.tagName)) {
											return true;
										}
										if (isTriggerable(child)) {
											return true;
										}
									}
								}
								
								// As a fallback, check parent element
								if (el.parentElement) return isTriggerable(el.parentElement);
								
								return false;
							} catch (e) {
								return false;
							}
						}
						
						function getInputType(el) {
							try {
								let type = '';
								if (el.tagName.toUpperCase() == 'INPUT') {
									type = el.getAttribute('type');
								}
								return type;
							} catch (e) {
								return '';
							}
						}
						
						function getElementText(el) {
							try {
								let text = el.innerText ? el.innerText : '';
								let type = el.getAttribute('type');
								
								// remove any newlines
								text = text.replace(/\n/g, ' ');
								// remove any extra whitespace
								text = text.replace(/\s+/g, ' ');
								// remove any leading or trailing whitespace
								text = text.trim();
								
								// if the element is a button, use the button text
								if (text == '') {
									if (
										el.tagName.toUpperCase() == 'INPUT' && 
										type && type.toUpperCase() == 'SUBMIT' &&
										el.getAttribute('value')
									) text = el.getAttribute('value');
								}
								if(!text) return "";
								return text;
							} catch (e) {
								return '';
							}
						}
						
						function getDescription(el) {
							try {
								if (el.getAttribute('aria-label'))
									return el.getAttribute('aria-label');
								if (el.getAttribute('alt'))
									return el.getAttribute('alt');
								if (el.getAttribute('role'))
									return el.getAttribute('role');
								return '';
							} catch (e) {
								return '';
							}
						}
						
						function getSelectOptions(el) {
							try {
								let options = [];
								el.querySelectorAll('option').forEach((option, index) => {
									let op = { value: option.value, text: option.text };
									options.push(op);
								});
								return options;
							} catch (e) {
								return [];
							}
						}
						
						function processNode(node, depth = 0) {
							if (depth > 50) return; // Prevent infinite recursion
							
							if (node.nodeType === 1) { // ELEMENT_NODE
								// Skip invisible elements and script tags
								if (!isElementVisible(node)) return;
								if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) return;
								
								// Process node if it has reasonable dimensions
								if (node.offsetWidth > 5 && node.offsetHeight > 5) {
									try {
										const rect = node.getBoundingClientRect();
										const text = getElementText(node);
										const isElmClickable = isClickable(node);
										const description = getDescription(node);
										const isElmTriggerable = isTriggerable(node); 
										const inputType = getInputType(node);
										const tagName = node.tagName;
										
										// Check specifically for nested anchor tags
										let containsAnchor = false;
										let anchorHref = null;
										const anchorEl = node.querySelector('a');
										if (anchorEl && anchorEl.getAttribute('href')) {
											containsAnchor = true;
											anchorHref = anchorEl.getAttribute('href');
										}
										
										// Check for other interactive elements
										const hasInteractiveChild = node.querySelector('button, [role="button"], [type="submit"], [type="checkbox"], [type="radio"]') !== null;
										
										// Create element object with coordinates adjusted for iframe position
										const elm: any = {
											id: node.id || '',
											class: node.className || '',
											index: index++,
											tagName: tagName,
											x: rect.x + iframePosition.x,
											y: rect.y + iframePosition.y,
											width: rect.width,
											height: rect.height,
											text: text,
											interactivity: [(isElmClickable || containsAnchor || hasInteractiveChild) ? 'clickable' : 'non-clickable', isElmTriggerable ? 'trigger' : 'non-trigger'],
											description: description,
											inputType: inputType,
											isIframe: true,
											iframePosition: iframePosition
										};
										
										// Add additional clickability information
										if (containsAnchor) {
											elm.containsAnchor = true;
											elm.anchorHref = anchorHref;
										}
										
										if (hasInteractiveChild) {
											elm.hasInteractiveChild = true;
										}

										// Add element-specific properties
										if (tagName === 'INPUT') {
											if (node.getAttribute('placeholder') != null) {
												elm.placeholder = node.getAttribute('placeholder').replace(/\$/g, '');
											}
											
											if (node.hasAttribute("src")) {
												elm.src = node.getAttribute('src');
											}
											
											if (node.value !== undefined) {
												elm.value = node.value;
											}
										}
										
										if (tagName === 'IMG') {
											elm.src = node.getAttribute('src');
										}
										
										if (tagName === 'A' && node.getAttribute('href')) {
											elm.href = node.getAttribute('href');
										}
										
										if (tagName === 'SELECT') {
											elm.options = getSelectOptions(node);
										}
										
										elements.push(elm);
									} catch (e) {
										// Skip elements that cause errors
									}
								}
								
								// Process children
								for (let i = 0; i < node.childNodes.length; i++) {
									processNode(node.childNodes[i], depth + 1);
								}
							}
						}
						
						// Start processing from the body
						if (document.body) {
							processNode(document.body);
						}
						
						return elements;
					}
					
					// Execute the processing function
					return processIframeElements(iframePosition);
				}, iframePosition, iframeSrc);
				
				if (iframeResult && iframeResult.length > 0) {
					console.log(`Found ${iframeResult.length} elements in iframe #${i+1}`);
					
					// Debug: Log clickable elements in iframe
					const clickableElements = iframeResult.filter(el => 
						el.interactivity && el.interactivity[0] === 'clickable'
					);
					console.log(`Found ${clickableElements.length} clickable elements in iframe #${i+1}`);
					
					// Debug: Check for specific element types that should be clickable
					const containerWithAnchors = iframeResult.filter(el => 
						el.containsAnchor === true
					);
					if (containerWithAnchors.length > 0) {
						console.log(`Found ${containerWithAnchors.length} elements with nested anchors in iframe #${i+1}`);
					}
					
					// Add iframe source to elements for reference
					iframeResult.forEach(el => {
						el.iframeSrc = iframeSrc;
					});
					
					// Add iframe elements to the main elements list
					elms = elms.concat(iframeResult);
					iframeElementsCount += iframeResult.length;
				}
			} catch (e) {
				console.log(`Error processing iframe #${i+1}: ${e.message}`);
			}
		}

			console.log(`Added ${iframeElementsCount} elements from iframes. Total elements: ${elms.length}`);
		*/
		
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
