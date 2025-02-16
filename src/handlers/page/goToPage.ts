import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession } from '../../apis/browsers-cmgr';
import { BaseRequest } from '../../helpers/Base';
import UTILITY from '../../helpers/utility';
import { VIEW_PORT, connectToBrowser } from '../../browser';
import {
	getCurrentPage,
	getPageCount,
	getPageAtIndex,
	takePageScreenshot,
} from '../../browser/pages';
import { awaitPageTillLoaded, waitTillNotBlankPage } from '../../browser/pages/awaitPage';
import { z } from 'zod';

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>().and(
	z.object({
		fullPage: z.boolean().optional(),
		stayOnPage: z.boolean().optional(),
		url: z.string().url(),
	})
);

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function goToPage(
	req: Request<RequestQuery, {}, RequestBody, RequestQuery>,
	res: Response,
	next: NextFunction,
) {
	// InitVars
	const cache: NodeCache = res.locals.cache;
	const session: BrowserSession = cache.get(res.locals.sessionID);

	// Validate Zod
	try {
		RequestBodySchema.parse(req.body)
		RequestQuerySchema.parse(req.query)
		RequestParamsSchema.parse(req.params)
	} catch (err) {
		next(err);
		return;
	}

	// LOGIC
	try {
		const puppeteerBrowser = await connectToBrowser(session.url);
		let { page, index } = await getCurrentPage(
			puppeteerBrowser,
			session.config,
		);
		const viewPort = session.config.viewport || VIEW_PORT;
		const pageCount = await getPageCount(puppeteerBrowser);

		// Go to page
		try {
			// Pre-define behavior for alert, confirm, and prompt
			await page.evaluateOnNewDocument(() => {
				window.alert = () => {}; // No-op for alert
				window.confirm = () => true; // Always return true for confirm
				window.prompt = (message, defaultValue) => defaultValue || ''; // Return the default value for prompt
			});
			
			res.log.info('Going to page');
			await page.goto(req.body.url, {
				waitUntil: 'load',
				timeout: 30000,
			});
			res.log.info('Page loaded successfully');
		} catch (e) {
			res.log.error({
				message: 'Timeout Error while going to page',
				request_id: res.locals.httpInfo.request_id,
				startTime: res.locals.generalInfo.startTime,
				httpInfo: res.locals.httpInfo,
			}, "page:goToPage:54");
		}

		// Retirable Logic to ensure page is loaded fully
		const settings = {
			encoding: 'binary',
			fullPage: false,
		};
		let retryAttempts = 3;
		while (retryAttempts > 0) {
			try {
				await waitTillNotBlankPage(page);
				res.log.info(`page is not blank, START GOTO: ${0}`);

				const startTime = new Date().getTime();
				await awaitPageTillLoaded(
					puppeteerBrowser,
					index,
					10,
					10000,
					settings,
				);
				res.log.info(`TIME GOTO 1 : ${
					(new Date().getTime() - startTime) / 1000
				}`);

				if (!req.body.stayOnPage) {
					// Check if page changed to a new tab
					const newPageCount = await getPageCount(puppeteerBrowser);
					res.log.info(`new page count: ${newPageCount}`);

					if (newPageCount > pageCount) {
						// Update page count
						const old = page;
						const currPageIndex = index + 1;
						const newPage = (
							await getPageAtIndex(
								puppeteerBrowser,
								session.config,
								currPageIndex
							)
						).page;

						await waitTillNotBlankPage(newPage);
						await awaitPageTillLoaded(
							puppeteerBrowser,
							currPageIndex,
							150,
							10000,
							settings,
						);
						await old.close();
					}
				}

				break;
			} catch (e) {
				if (e.message.includes('Execution context was destroyed')) {
					res.log.error({
						message:
							'Execution context was destroyed, retrying..',
						request_id: res.locals.httpInfo.request_id,
						startTime: res.locals.generalInfo.startTime,
						httpInfo: res.locals.httpInfo,
					}, "page:goToPage:92");
					retryAttempts--;
					continue;
				}

				throw e;
			}
		}

		// log success
		res.locals.httpInfo.status_code = 200;
		res.log.info('Page loaded successfully');

		// Get page image and scroller info
		const devicePixelRatio = await page.evaluate(
			() => window.devicePixelRatio,
		);

		//let pageImg = ""
		//for (let attempts=0; attempts<2; attempts++) {
		//	logger.logCustom(`Attempting to take screen shot: ${attempts}`)
		//	try {
		//		pageImg = await takePageScreenshot(
		//			page,
		//			session.config,
		//			req.body.fullPage,
		//		);
		//		logger.logCustom(`Screenshot taken successfully: ${attempts}`)
		//		break
		//	} catch (e) {
		//		const newPage = await getCurrentPage(
		//			puppeteerBrowser,
		//			session.config,
		//		);
		//		page = newPage.page
		//		index = newPage.index
		//	}
		//}

		const scroller = await page.evaluate(() => {
			return {
				scrollX: Number(window.scrollX),
				scrollY: Number(window.scrollY),
				scrollHeight: Number(document.body.scrollHeight),
			};
		});

		res.log.info('Screenshot successfully taken');

		puppeteerBrowser.disconnect();
		UTILITY.EXPRESS.respond(res, 200, {
			sessionID: session.sessionID,
			page: {
				url: page.url(),
				devicePixelRatio: devicePixelRatio,
				scroller: scroller,
				pageDimensions: {
					width: viewPort.width,
					height: scroller.scrollHeight,
				},
				img: "",
			},
		});
	} catch (err) {
		// log Error
		res.locals.httpInfo.status_code = 500;
		res.log.error({
			message: err.message,
			stack: err.stack,
			request_id: res.locals.httpInfo.request_id,
			startTime: res.locals.generalInfo.startTime,
			httpInfo: res.locals.httpInfo,
		}, "page:goToPage:119");

		UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}

	// Move to next function
	next();
}

export default goToPage;
