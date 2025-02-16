import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession } from '../../apis/browsers-cmgr';
import { BaseRequest } from '../../helpers/Base';
import UTILITY from '../../helpers/utility';
import { connectToBrowser } from '../../browser';
import { getCurrentPage } from '../../browser/pages';
import { z } from 'zod';

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>();

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function getWindowInfo(
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
		const puppeteerBrowser = await connectToBrowser(session.url);
		const { page } = await getCurrentPage(puppeteerBrowser, session.config);

		// Get window info
		const devicePixelRatio = await page.evaluate(
			() => window.devicePixelRatio,
		);
		const win_scroll_x = await page.evaluate(() => window.scrollX);
		const win_scroll_y = await page.evaluate(() => window.scrollY);
		const win_upper_bound = await page.evaluate(() => window.pageYOffset);
		const win_left_bound = await page.evaluate(() => window.pageXOffset);
		const win_width = await page.evaluate(() => window.screen.width);
		const win_height = await page.evaluate(() => window.screen.height);
		const win_right_bound = win_left_bound + win_width;
		const win_lower_bound = win_upper_bound + win_height;
		const document_offset_height = await page.evaluate(
			() => document.body.offsetHeight,
		);
		const document_scroll_height = await page.evaluate(
			() => document.body.scrollHeight,
		);

		res.locals.httpInfo.status_code = 200;
		puppeteerBrowser.disconnect();
		UTILITY.EXPRESS.respond(res, 200, {
			sessionID: session.sessionID,
			windowInfo: {
				devicePixelRatio: devicePixelRatio,
				win_scroll_x: win_scroll_x,
				win_scroll_y: win_scroll_y,
				win_upper_bound: win_upper_bound,
				win_left_bound: win_left_bound,
				win_width: win_width,
				win_height: win_height,
				win_right_bound: win_right_bound,
				win_lower_bound: win_lower_bound,
				document_offset_height: document_offset_height,
				document_scroll_height: document_scroll_height,
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
		}, "page:getWindowInfo:74");

		UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}

	// Move to next function
	next();
}

export default getWindowInfo;
