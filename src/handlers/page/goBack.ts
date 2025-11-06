import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession } from '../../apis/browsers-cmgr';
import { BaseRequest } from '../../helpers/Base';
import { Logger } from 'pino';
import UTILITY from '../../helpers/utility';
import { VIEW_PORT, connectToBrowser } from '../../browser';
import { getBrowserURL } from '../../apis/browsers-cmgr';
import {
	getCurrentPage,
	getPageCount,
	getPageAtIndex,
} from '../../browser/pages';
import { awaitPageTillLoaded, waitTillNotBlankPage } from '../../browser/pages/awaitPage';
import { z } from 'zod';

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>().and(
	z.object({
		stayOnPage: z.boolean().optional(),
	})
);

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function goBack(
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
		const puppeteerBrowser = await connectToBrowser(
			res.log,
			res.locals.importantHeaders ? res.locals.importantHeaders : {},
			getBrowserURL(session),
			res.locals.sessionID
		);
		let { page, index } = await getCurrentPage(
			res.log,
			res.locals.importantHeaders ? res.locals.importantHeaders : {},
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
			
			await page.goBack()
		} catch (error) {
			res.log.error({
				...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "ENDPOINT_ERROR")
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

				const startTime = new Date().getTime();
				await awaitPageTillLoaded(
					res.log,
					res.locals.importantHeaders ? res.locals.importantHeaders : {},
					puppeteerBrowser,
					index,
					10,
					10000,
					settings,
				);

				if (!req.body.stayOnPage) {
					// Check if page changed to a new tab
					const newPageCount = await getPageCount(puppeteerBrowser);

					if (newPageCount > pageCount) {
						// Update page count
						const old = page;
						const currPageIndex = index + 1;
						const newPage = (
							await getPageAtIndex(
								res.log,
								res.locals.importantHeaders ? res.locals.importantHeaders : {},
								puppeteerBrowser,
								session.config,
								currPageIndex
							)
						).page;

						await waitTillNotBlankPage(newPage);
						await awaitPageTillLoaded(
							res.log,
							res.locals.importantHeaders ? res.locals.importantHeaders : {},
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
			} catch (error) {
				if (error.message.includes('Execution context was destroyed')) {
					res.log.warn({
						...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
						message: 'Execution context was destroyed, retrying..',
					}, "ENDPOINT_ERROR")
					retryAttempts--;
					continue;
				} else {
					res.log.error({
						...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
						message: error instanceof Error ? error.message : "Unknown error",
						stack: error instanceof Error ? error.stack : undefined,
					}, "ENDPOINT_ERROR")
				}

				throw error;
			}
		}

		// log success
		res.locals.httpInfo.status_code = 200;

		// Get page image and scroller info
		const devicePixelRatio = await page.evaluate(
			() => window.devicePixelRatio,
		);

		const scroller = await page.evaluate(() => {
			return {
				scrollX: Number(window.scrollX),
				scrollY: Number(window.scrollY),
				scrollHeight: Number(document.body.scrollHeight),
			};
		});

		// puppeteerBrowser.disconnect();
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
	} catch (error) {
		// log Error
		res.locals.httpInfo.status_code = 500;
		res.log.error({
			...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
			message: error instanceof Error ? error.message : "Unknown error",
			stack: error instanceof Error ? error.stack : undefined,
		}, "ENDPOINT_ERROR")

		UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}

	// Move to next function
	next();
}

export default goBack;
