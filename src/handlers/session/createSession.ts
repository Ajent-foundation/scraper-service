import { NextFunction, Request, Response } from 'express';
import NodeCache from 'node-cache';
import {
	SessionInfo,
	BrowserSession,
	getSessionInfo,
	BrowserConfig,
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
	proxyConfig: z.object({
		countryCode: z.string(),
		network: z.custom<Network>(),
	}).optional(),
	sessionData: z.string().optional(),
	fingerprintID: z.string().optional(),
	reportKey: z.string().optional(),
	callbackURL: z.string().optional(),
	driver: z.string().optional(),
	numberOfCameras: z.number().min(1).max(4).optional(),
 	numberOfMicrophones: z.number().min(1).max(4).optional(),
 	numberOfSpeakers: z.number().min(1).max(4).optional(),
 	locale: z.string().optional(),
 	language: z.string().optional(),
 	timezone: z.string().optional(),
 	platform: z.enum(["win32", "linux", "darwin"]).optional(),
 	extensions: z.array(z.string()).optional(),
 	overrideUserAgent: z.string().optional(),
	vnc: z.enum(["legacy", "new"]).optional(),
	vncMode: z.enum(["ro", "rw"]).optional(),
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

	// Validate Zod
	try {
		RequestBodySchema.parse(req.body)
		RequestQuerySchema.parse(req.query)
		RequestParamsSchema.parse(req.params)
	} catch (err) {
		next(err);
		return;
	}

	if(!req.body.vnc){
		req.body.vnc = "legacy"
	}

	if(!req.body.vncMode){
		req.body.vncMode = "ro"
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
			res.locals.httpInfo.status_code = 400;
			res.log.info({
				...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
				message: 'Session Already Exists',
				sessionID: sessionID,
				leaseTime: res.locals.cacheTimeout,
				browser
			}, "ENDPOINT_SUCCESS")

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
						res.locals.httpInfo.status_code = 400;
						res.log.info({
							...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
							message: 'Invalid Viewport',
							details:
								'Invalid viewport must be between 601*962 and 1920*1080',
						}, "ENDPOINT_ERROR")

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
						res.locals.httpInfo.status_code = 400;
						res.log.info({
							...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
							message: 'Missing proxyConfig',
						}, "ENDPOINT_ERROR")

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
						res.locals.httpInfo.status_code = 400;
						res.log.info({
							...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
							message: 'Invalid Country Code',
						}, "ENDPOINT_ERROR")

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
					{
						...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
					},
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
					{
						numberOfCameras: req.body.numberOfCameras,
						numberOfMicrophones: req.body.numberOfMicrophones,
						numberOfSpeakers: req.body.numberOfSpeakers,
						locale: req.body.locale,
						language: req.body.language,
						timezone: req.body.timezone,
						platform: req.body.platform,
						screen: req.body.config && req.body.config.viewport ? {
							resolution: `${req.body.config.viewport.width}x${req.body.config.viewport.height}`,
							dpi: `${req.body.config.viewport.dpi || "96"}`,
							depth: `${req.body.config.viewport.depth || "24"}`,
						} : undefined,
					},
					req.body.vnc,
					null,
					false,
					network,
					country,
					req.body.useProxy,
					req.body.sessionData ? req.body.sessionData : '',
				);
			} catch (error: unknown) {
				// log Error
				res.locals.httpInfo.status_code = 503;
				res.log.error({
					...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
					message: error instanceof Error ? error.message : "Unknown error",
					stack: error instanceof Error ? error.stack : undefined,
				}, "CREATE_SESSION_ERROR")

				return UTILITY.EXPRESS.respond(res, 503, {
					code: 'SERVICE_UNAVAILABLE',
					message: 'Service Unavailable',
				});
			}

			// Get container hostname from detailedStatus
			let hostname: string | undefined = undefined;
			try {
				const cmgrState = await detailedStatus();
				const browser = cmgrState.browsers.find((b) => b.labels.id === sessionInfo.browserID);
				if (browser) {
					hostname = browser.name; // Container name
				}
			} catch (err) {
				// If we can't get hostname, fall back to environment variable or localhost
				res.log.warn({ error: err }, "Failed to get container hostname, using default");
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
				hostname: hostname,
			};

			// Set session to cache
			cache.set(sessionID, session, res.locals.cacheTimeout);

			// log success
			res.locals.httpInfo.status_code = 201;
			res.log.info({
				...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
				message: 'Session Created Successfully',
				sessionID: sessionID,
				leaseTime: res.locals.cacheTimeout,
				browserID: session.browserID,
			}, "ENDPOINT_SUCCESS")

			return UTILITY.EXPRESS.respond(res, 201, session);
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

export default createSession;
