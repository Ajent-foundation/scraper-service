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

export const RequestBodySchema = z.custom<BaseRequest>();

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function getPDF(
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
		const { page } = await getCurrentPage(
			res.log,
			res.locals.importantHeaders ? res.locals.importantHeaders : {},
			puppeteerBrowser,
			session.config,
		);

		const pagePDF = await page.pdf({
			format: 'A4',
		})

		// Send File Response
		const base64PDF = pagePDF.toString('base64');

		res.locals.httpInfo.status_code = 200;
		// puppeteerBrowser.disconnect();
		UTILITY.EXPRESS.respond(res, 200, {
			page: base64PDF,
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

export default getPDF;
