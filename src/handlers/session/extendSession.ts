import { NextFunction, Request, Response } from 'express';
import { Logger } from 'pino';
import {
	getSessionInfo,
} from '../../apis/browsers-cmgr';
import UTILITY from '../../helpers/utility';
import { z } from 'zod';
import { detailedStatus, IDetailedStatusResponse } from '../../apis/browser-cmgr/detailedStatus';

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.object({
	sessionID: z.string(),
	leaseTime: z.number().min(1).max(60),
});

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function extendSession(
	req: Request<RequestParams, {}, RequestBody, RequestQuery>,
	res: Response,
	next: NextFunction,
) {
	// InitVars

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
		const sessionID = req.body.sessionID;

		let cmgrState: IDetailedStatusResponse;
		try {
			cmgrState = await detailedStatus()
		} catch (err) {
			UTILITY.EXPRESS.respond(res, 500, {
				code: "SERVICE_UNAVAILABLE",
				message: "Service Unavailable"
			})
			return;
		}
		const browser = cmgrState.browsers.find((b)=> b.sessionID === sessionID)

		// check if session still exists
		if (browser) {
            await getSessionInfo(
                res.log,
				{
					...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
				},
                browser.clientID,
                req.body.leaseTime || 10,
                browser.isDebug,
                browser.viewport,
                sessionID,
                {},
				{},
                null,
				"legacy",
                false,
                undefined,
                undefined,
                false,
                "",
                true,
            );

            return UTILITY.EXPRESS.respond(res, 200, {
                code: 'SESSION_EXTENDED',
                message: 'Session Extended',
            });
		} else {
            // log Error
			res.locals.httpInfo.status_code = 404;

			// cannot overwrite existing session
			return UTILITY.EXPRESS.respond(res, 404, {
				code: 'SESSION_NOT_FOUND',
				message: 'Session Not Found',
			});
		}
	} catch (error) {
		// log error
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

export default extendSession;
