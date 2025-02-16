import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession } from '../../apis/browsers-cmgr';
import { BaseRequest } from '../../helpers/Base';
import UTILITY from '../../helpers/utility';
import { Browser } from 'puppeteer';
import { connectToBrowser } from "../../browser"
import { z } from 'zod';

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>().and(
	z.object({
		index: z.number().int().nonnegative(),
	})
);

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function closePage(
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
		const puppeteerBrowser:Browser = await connectToBrowser(session.url)

		// close page
		const pages = await puppeteerBrowser.pages();
		if (req.body.index >= pages.length) {
			// cannot switch to non-existing tab
			return UTILITY.EXPRESS.respond(res, 400, {
				code: 'SESSION_TAB_NOT_FOUND',
				message: 'Tab not found',
			});
		}

		if(pages.length === 1){
			return UTILITY.EXPRESS.respond(res, 400, {
				code: 'SESSION_TAB_NOT_FOUND',
				message: 'Cannot close the last tab',
			});
		}

		const page = pages[req.body.index];
		await page.close();

		res.locals.httpInfo.status_code = 200;
		puppeteerBrowser.disconnect();
		UTILITY.EXPRESS.respond(res, 200, {});
	} catch (err) {
		// log Error
		res.locals.httpInfo.status_code = 500;
		res.log.error({
			message: err.message,
			stack: err.stack,
			request_id: res.locals.httpInfo.request_id,
			startTime: res.locals.generalInfo.startTime,
			httpInfo: res.locals.httpInfo,
		}, "page:closePage:90");

		UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}

	// Move to next function
	next();
}

export default closePage;
