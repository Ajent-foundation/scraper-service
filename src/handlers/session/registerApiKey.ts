import { NextFunction, Request, Response } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession } from '../../apis/browsers-cmgr';
import UTILITY from '../../helpers/utility';
import { z } from 'zod';
import axios from 'axios';

export const RequestParamsSchema = z.object({
	sessionID: z.string(),
});

export const RequestBodySchema = z.object({
	apiKey: z.string(),
});

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function registerApiKey(
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
		if (!session) {
			return UTILITY.EXPRESS.respond(res, 404, {
				code: 'SESSION_NOT_FOUND',
				message: 'Session not found',
			});
		}

		// Proxy request to VNC port
		const vncUrl = `http://localhost:${session.vncPort}/apiKeys/register`;
		
		try {
			const vncResponse = await axios.post(vncUrl, req.body, {
				timeout: 10000,
				headers: {
					'Content-Type': 'application/json'
				}
			});
			
			return UTILITY.EXPRESS.respond(res, vncResponse.status, vncResponse.data);
		} catch (vncError) {
			if (axios.isAxiosError(vncError)) {
				const status = vncError.response?.status || 503;
				const data = vncError.response?.data || {
					code: 'VNC_SERVICE_UNAVAILABLE',
					message: 'VNC service is not available'
				};
				return UTILITY.EXPRESS.respond(res, status, data);
			}
			throw vncError;
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

export default registerApiKey; 