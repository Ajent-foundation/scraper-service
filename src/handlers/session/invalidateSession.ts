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
				res.log.warn({
					message: 'session already invalidated!',
					sessionID: 'sessionID',
				}, "session:invalidateSession:51");
			}

			// log success
			res.log.info({
				message: 'session invalidated',
				sessionID: 'sessionID',
			}, "session:invalidateSession:66");

			return UTILITY.EXPRESS.respond(res, 200, {});
		} else {
			// log error
			res.log.error({
				message: 'session not found',
				startTime: res.locals.generalInfo.startTime,
			}, "session:invalidateSession:82");
			return UTILITY.EXPRESS.respond(res, 404, {
				code: 'SESSION_NOT_FOUND',
				message: 'Session Not Found',
			});
		}
	} catch (err) {
		// Log error
		res.log.error({
			message: err.message,
			stack: err.stack,
			startTime: res.locals.generalInfo.startTime,
		}, "session:invalidateSession:102");
		return UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}
}

export default invalidateSession;
