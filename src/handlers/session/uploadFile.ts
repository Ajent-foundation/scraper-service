import { NextFunction, Request, Response } from 'express';
import NodeCache from 'node-cache';
import { Logger } from 'pino';
import { BrowserSession } from '../../apis/browsers-cmgr';
import UTILITY from '../../helpers/utility';
import { uploadFile } from '../../apis/node';
import { z } from 'zod';

export const RequestParamsSchema = z.object({
	sessionID: z.string(),
});

export const RequestBodySchema = z.object({
	base64File: z.string(),
});

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function uploadFileToSession(
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
			const firstColon = session.url.indexOf(':');
            const baseUrl = session.url.substring(0, session.url.indexOf(':', firstColon + 1));

			// Get session data
			return UTILITY.EXPRESS.respond(
				res,
				200,
				await uploadFile(
					res.log,
					{
						...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
					},
					baseUrl,
					req.body.base64File,
				),
			);
		} else {
			// Session does not exist
			return UTILITY.EXPRESS.respond(res, 404, {
				code: 'SESSION_NOT_FOUND',
				message: 'Session not found',
			});
		}
	} catch (error:unknown) {
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

export default uploadFileToSession;
