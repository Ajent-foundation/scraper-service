import { NextFunction, Request, Response } from 'express';
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
                res.locals.logger,
                browser.clientID,
                req.body.leaseTime || 10,
                browser.isDebug,
                browser.viewport,
                sessionID,
                {},
                null,
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
	} catch (err) {
		// log error
		res.locals.httpInfo.status_code = 500;
		res.log.error({
			message: err.message,
			stack: err.stack,
			request_id: res.locals.httpInfo.request_id,
			startTime: res.locals.generalInfo.startTime,
			httpInfo: res.locals.httpInfo,
		}, "session:extendSession:169");

		return UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}
}

export default extendSession;
