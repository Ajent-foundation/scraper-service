import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession } from '../../apis/browsers-cmgr';
import { BaseRequest } from '../../helpers/Base';
import UTILITY from '../../helpers/utility';
import { Browser } from 'puppeteer';
import { connectToBrowser } from "../../browser"
import { z } from 'zod';

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>();

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function newPage(
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

		// create new page
		await puppeteerBrowser.newPage();

		puppeteerBrowser.disconnect();
		UTILITY.EXPRESS.respond(res, 200, {});
	} catch (err) {
		// log Error
		res.log.error({
			message: err.message,
			stack: err.stack,
			startTime: res.locals.generalInfo.startTime,
		}, "page:newPage:79");

		UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}

	// Move to next function
	next();
}

export default newPage;
