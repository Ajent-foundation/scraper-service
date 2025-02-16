import { NextFunction, Request, Response } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession } from '../../apis/browsers-cmgr';
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

async function getSession(
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

	try {
		const sessionID = req.params.sessionID;
		const session: BrowserSession | undefined = cache.get(sessionID);

		// check if session still exists
		if (session) {
			// return session info and status
			return UTILITY.EXPRESS.respond(res, 200, session);
		} else {
			// Session does not exist
			return UTILITY.EXPRESS.respond(res, 404, {
				code: 'SESSION_NOT_FOUND',
				message: 'Session not found',
			});
		}
	} catch (err) {
		// Log error
		res.log.error({
			message: err.message,
			stack: err.stack,
			startTime: res.locals.generalInfo.startTime,
		}, "session:getSession:39");
		return UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}
}

export default getSession;
