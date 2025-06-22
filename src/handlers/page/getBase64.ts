import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { Logger } from 'pino';
import { BrowserSession } from '../../apis/browsers-cmgr';
import { BaseRequest } from '../../helpers/Base';
import UTILITY from '../../helpers/utility';
import { Browser } from 'puppeteer';
import { connectToBrowser } from '../../browser';
import { getCurrentPage } from '../../browser/pages';
import { z } from 'zod';

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>().and(
	z.object({
		x: z.number(),
		y: z.number(),
		width: z.number().positive(),
		height: z.number().positive(),
	})
);

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function getBase64(
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

	// Logic
	try {
		const puppeteerBrowser: Browser = await connectToBrowser(
			res.log,
			res.locals.importantHeaders ? res.locals.importantHeaders : {},
			session.url,
			res.locals.sessionID
		);
		const { page } = await getCurrentPage(res.log, res.locals.importantHeaders ? res.locals.importantHeaders : {}, puppeteerBrowser, session.config);

		const img = await page.screenshot({
			optimizeForSpeed: true,
			encoding: 'base64',
			clip: {
				x: req.body.x,
				y: req.body.y,
				width: req.body.width,
				height: req.body.height,
			},
		});

		res.locals.httpInfo.status_code = 200;
		// puppeteerBrowser.disconnect();
		UTILITY.EXPRESS.respond(res, 200, {
			base64Encoding: img,
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

export default getBase64;
