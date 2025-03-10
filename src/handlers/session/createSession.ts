import { NextFunction, Request, Response } from 'express';
import NodeCache from 'node-cache';
import {
	SessionInfo,
	BrowserSession,
	getSessionInfo,
	BrowserConfig,
	MobileConfig,
	MobileSession,
} from '../../apis/browsers-cmgr';
import { Network } from '../../base/proxy/brightdata';
import { TheGlobe, Country } from '../../base/global/index';
import UTILITY from '../../helpers/utility';
import { z } from 'zod';
import { detailedStatus, IDetailedStatusResponse } from '../../apis/browser-cmgr/detailedStatus';

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.object({
	sessionID: z.string(),
	sessionUUID: z.string().optional(),
	clientID: z.string().optional(),
	leaseTime: z.number().optional(),
	useProxy: z.boolean().optional(),
	config: z.custom<BrowserConfig>().optional(),
	mobileConfig: z.custom<MobileConfig>().optional(),
	proxyConfig: z.object({
		countryCode: z.string(),
		network: z.custom<Network>(),
	}).optional(),
	sessionData: z.string().optional(),
	fingerprintID: z.string().optional(),
	driver: z.string().optional(),
	reportKey: z.string().optional(),
	callbackURL: z.string().optional(),
});

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function createSession(
	req: Request<RequestParams, {}, RequestBody, RequestQuery>,
	res: Response,
	next: NextFunction,
) {
	// InitVars
	const cache: NodeCache = res.locals.cache;
	const isMobileSession = !!req.body.mobileConfig;
	let apiKey: string | undefined;

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
		let isValidSession: boolean;

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
		isValidSession = cache.has(sessionID);
		if (isValidSession && browser) {
			// log Error
			res.log.error({
				message: 'parallel session creation not allowed',
				startTime: res.locals.generalInfo.startTime,
			}, "session:createSession:36");

			// cannot overwrite existing session
			return UTILITY.EXPRESS.respond(res, 400, {
				code: 'SESSION_ALREADY_EXISTS',
				message: 'Session Already Exists',
			});
		} else {
			// Delete existing session
			cache.del(sessionID)
			
			// Create new session
			let browserConfig: BrowserConfig;

			// Set Browser config
			if (req.body.config) {
				// Validate config
				// Viewport
				if (req.body.config.viewport) {
					// MAX 5120×5120 - Min 601×962
					if (
						req.body.config.viewport.width > 5120 ||
						req.body.config.viewport.width < 601 ||
						req.body.config.viewport.height > 16384 ||
						req.body.config.viewport.height < 962
					) {
						res.log.error({
							message: 'Invalid Viewport',
							startTime: res.locals.generalInfo.startTime,
						}, "session:createSession:69");

						return UTILITY.EXPRESS.respond(res, 400, {
							code: 'INVALID_REQUEST',
							message: 'Invalid Request',
							details:
								'Invalid viewport must be between 601*962 and 1920*1080',
						});
					}
				}

				browserConfig = req.body.config;
			} else {
				browserConfig = {};
			}

			// Get browser instance
			let sessionInfo: SessionInfo;
			try {
				// Proxy Setup
				let network: Network;
				let country: Country;
				if (req.body.useProxy) {
					if (!req.body.proxyConfig) {
						res.log.error({
							message: 'Missing proxyConfig',
							startTime: res.locals.generalInfo.startTime,
						}, "session:createSession:63");

						return UTILITY.EXPRESS.respond(res, 400, {
							code: 'INVALID_REQUEST',
							message: 'Invalid Request',
							details: 'Missing proxyConfig',
						});
					}

					// verify countryCode
					country = TheGlobe.getCountryByCode(
						req.body.proxyConfig.countryCode,
					);
					if (country) {
						network = req.body.proxyConfig.network;
					} else {
						res.log.error({
							message: 'Invalid Country Code',
							startTime: res.locals.generalInfo.startTime,
						}, "session:createSession:88");

						return UTILITY.EXPRESS.respond(res, 400, {
							code: 'INVALID_REQUEST',
							message: 'Invalid Request',
							details: 'Invalid countryCode',
						});
					}
				}

				// Browser Getter
				sessionInfo = await getSessionInfo(
					res.log,
					req.body.clientID,
					req.body.leaseTime || 10,
					browserConfig.isDebug ? browserConfig.isDebug : false,
					browserConfig.viewport,
					sessionID,
					{
						fingerprintID: req.body.fingerprintID,
						driver: req.body.driver,
						reportKey: req.body.reportKey,
						callbackURL: req.body.callbackURL,
						sessionUUID: req.body.sessionUUID,
					},
					null,
					false,
					network,
					country,
					req.body.useProxy,
					req.body.sessionData ? req.body.sessionData : '',
				);
			} catch (err) {
				// log Error
				res.log.error({
					message: err.message,
					stack: err.stack,
				}, "session:createSession:119");

				return UTILITY.EXPRESS.respond(res, 503, {
					code: 'SERVICE_UNAVAILABLE',
					message: 'Service Unavailable',
				});
			}

			// create session object
			const session: BrowserSession = {
				browserID: sessionInfo.browserID,
				leaseTime: req.body.leaseTime || 10,
				url: sessionInfo.url,
				sessionID: sessionID,
				appPort: sessionInfo.appPort,
				wsPort: sessionInfo.wsPort,
				vncPort: sessionInfo.vncPort,
				type: 'browser',
				jobs: [],
				config: browserConfig,
				vncPassword: sessionInfo.vncPassword,
			};

			// Set session to cache
			cache.set(sessionID, session, res.locals.cacheTimeout);

			// log success
			res.log.info({
				message: 'Session Created Successfully',
				sessionID: sessionID,
				leaseTime: res.locals.cacheTimeout,
				browserID: session.browserID,
			}, "session:createSession:150");

			return UTILITY.EXPRESS.respond(res, 201, session);
		}
	} catch (err) {
		// log error
		res.log.error({
			message: err.message,
			stack: err.stack,
			startTime: res.locals.generalInfo.startTime,
		}, "session:createSession:169");

		return UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}
}

export default createSession;
