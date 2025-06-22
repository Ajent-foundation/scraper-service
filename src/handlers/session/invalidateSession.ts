import { NextFunction, Request, Response } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession, freeUpSession } from '../../apis/browsers-cmgr';
import UTILITY from '../../helpers/utility';
import { z } from 'zod';

export const RequestParamsSchema = z.object({
	sessionID: z.string(),
});

export const RequestBodySchema = z.object({});

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function invalidateSession(
	req: Request<RequestParams, {}, RequestBody, RequestQuery>,
	res: Response,
	next: NextFunction,
) {
	// InitVars
	const cache: NodeCache = res.locals.cache;

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
		const sessionID: string = req.params.sessionID;
		const session: BrowserSession | undefined = cache.get(sessionID);

		// check if session still exists
		if (session) {
			// Invalidate session
			const data = cache.data;
			const keys = Object.keys(data);
			let isInvalidated = false;

			// Handle browser session end
			for (const key of keys) {
				const session = data[key].v;
				if (session.sessionID === sessionID) {
					//Free up browser
					isInvalidated = true;
					await freeUpSession(session.browserID)

					cache.del(session.sessionID);
					break;
				}
			}

			if (!isInvalidated) {
				// log warning
				res.log.error({
					...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
					message: "Session already invalidated",
				}, "ENDPOINT_ERROR")
			}

			// log success
			res.locals.httpInfo.status_code = 200;
			res.log.info({
				...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
				message: "Session invalidated",
			}, "ENDPOINT_SUCCESS")


			return UTILITY.EXPRESS.respond(res, 200, {});
		} else {
			// log error
			res.locals.httpInfo.status_code = 404;
			res.log.error({
				...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
				message: "Session not found",
			}, "ENDPOINT_ERROR")

			return UTILITY.EXPRESS.respond(res, 404, {
				code: 'SESSION_NOT_FOUND',
				message: 'Session Not Found',
			});
		}
	} catch (error) {
		// Log error
		res.locals.httpInfo.status_code = 500;
		res.log.error({
			...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
			message: error instanceof Error ? error.message : "Unknown error",
			stack: error instanceof Error ? error.stack : undefined,
		}, "ENDPOINT_ERROR")

		return UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}
}

export default invalidateSession;
