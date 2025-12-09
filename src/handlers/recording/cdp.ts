import { NextFunction, Request, Response } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession } from '../../apis/browsers-cmgr';
import UTILITY from '../../helpers/utility';
import { getRecordingCdp } from '../../apis/node';
import { z } from 'zod';

export const RequestParamsSchema = z.object({
	sessionID: z.string(),
});

export const RequestQuerySchema = z.object({
	sessionId: z.string().optional(),
	method: z.string().optional(),
	direction: z.string().optional(),
	limit: z.string().optional(),
});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function cdp(
	req: Request<RequestParams, {}, {}, RequestQuery>,
	res: Response,
	next: NextFunction,
) {
	const cache: NodeCache = res.locals.cache;

	try {
		RequestParamsSchema.parse(req.params);
		RequestQuerySchema.parse(req.query);
	} catch (err) {
		next(err);
		return;
	}

	try {
		const sessionID = req.params.sessionID;
		const session: BrowserSession | undefined = cache.get(sessionID);

		if (!session) {
			return UTILITY.EXPRESS.respond(res, 404, {
				code: 'SESSION_NOT_FOUND',
				message: 'Session not found',
			});
		}

		const firstColon = session.url.indexOf(':');
		const baseUrl = session.url.substring(0, session.url.indexOf(':', firstColon + 1));

		const data = await getRecordingCdp(
			res.log,
			{ ...(res.locals.importantHeaders ? res.locals.importantHeaders : {}) },
			baseUrl,
			req.query.sessionId,
			req.query.method,
			req.query.direction,
			req.query.limit ? parseInt(req.query.limit) : undefined,
		);
		return UTILITY.EXPRESS.respond(res, 200, data);
	} catch (error) {
		res.locals.httpInfo.status_code = 500;
		res.log.error({
			...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
			message: error instanceof Error ? error.message : "Unknown error",
			stack: error instanceof Error ? error.stack : undefined,
		}, "ENDPOINT_ERROR");

		return UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}
}

export default cdp;

