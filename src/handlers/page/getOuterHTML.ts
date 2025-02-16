import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession } from '../../apis/browsers-cmgr';
import { BaseRequest } from '../../helpers/Base';
import UTILITY from '../../helpers/utility';
import { Browser } from 'puppeteer';
import { connectToBrowser } from '../../browser';
import { getCurrentPage } from '../../browser/pages';
import { z } from 'zod';

export const CoordinateSchema = z.object({
	x: z.number(),
	y: z.number(),
});

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>().and(
	z.object({
		coordinates: z.array(CoordinateSchema),
	})
);

export const RequestQuerySchema = z.object({});

export type coordinate = z.infer<typeof CoordinateSchema>;
export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function getOuterHTML(
	req: Request<RequestQuery, {}, RequestBody, RequestQuery>,
	res: Response,
	next: NextFunction,
) {
	// InitVars
	let cache: NodeCache = res.locals.cache;
	let session: BrowserSession = cache.get(res.locals.sessionID);

	// Validate Zod
	try {
		RequestBodySchema.parse(req.body)
		RequestQuerySchema.parse(req.query)
		RequestParamsSchema.parse(req.params)
	} catch (err) {
		next(err);
		return;
	}

	// Logic
	try {
		const puppeteerBrowser: Browser = await connectToBrowser(session.url);
		const { page } = await getCurrentPage(puppeteerBrowser, session.config);

		let response = {};
		for (let position of req.body.coordinates) {
			let outerHTML = await page.evaluate(
				(x, y) => {
					let element = document.elementFromPoint(x, y);
					if (element) {
						return element.outerHTML;
					}
					return '';
				},
				position.x,
				position.y,
			);
			response[`(${position.x},${position.y})`] = outerHTML;
		}

		res.locals.httpInfo.status_code = 200;
		puppeteerBrowser.disconnect();
		UTILITY.EXPRESS.respond(res, 200, {
			sessionID: session.sessionID,
			outerHTMLs: response,
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
		}, "page:getOuterHTML:68");

		UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}

	// Move to next function
	next();
}

export default getOuterHTML;
