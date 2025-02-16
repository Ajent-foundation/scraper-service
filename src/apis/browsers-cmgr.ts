import axios, { AxiosResponse, isAxiosError } from 'axios';
import {
	getProxyServerString,
	getBrightDataAuth,
} from '../base/proxy/brightdata';
import { Network } from '../base/proxy/brightdata';
import { TheGlobe, Country } from '../base/global/index';
import { Logger } from 'pino';

export type Job = {
	jobID: string;
	endpoint: string;
};

export type BrowserViewPort = {
	width: number;
	height: number;
};

export type BrowserConfig = {
	isDebug?: boolean;
	viewport?: BrowserViewPort;
	ghostCursor?: boolean;
	cursorConfig?: {}
};

export type BaseSession = {
	sessionID: string;
	jobs: Job[];
	type: "browser" | "mobile";
}

export type BrowserSession = BaseSession & {
	browserID: string;
	leaseTime: number;
	url: string;
	appPort: number;
	wsPort: number;
	vncPort: number;
	config: BrowserConfig;
	vncPassword?: string;
};

export type MobileConfig = {
	package?: string;
	min_sdk?: number;
	emulation?: boolean;
	reset_storage?: boolean;
	stream?: boolean;
	apk?: Express.Multer.File | null;
	gplay_installation?: boolean;
	device_uuid?: string;
};

export type MobileSession = BaseSession & {
	config: MobileConfig;
};

export interface IBrowser {
	logger: Logger;
}

export type SessionInfo = {
	sessionID: string;
	browserID: string;
	vncPassword: string;
	url: string;
	appPort: number;
	wsPort: number;
	vncPort: number;
};

export async function freeUpSession(browserID: string) {
	try {
		await axios.post(
			`${process.env.BROWSER_POC_SERVICE}/freeBrowser`,
			{ browserID },
			{
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);
	} catch (error) {}
}

export async function getSessionInfo(
	logger: Logger,
	clientID: string | undefined,
	leaseTime: number,
	isDebug: boolean | undefined,
	viewport: BrowserViewPort | undefined,
	userID: string,
	extraData: {
		fingerprintID?: string;
		driver?: string;
		reportKey?: string;
		callbackURL?: string;
		sessionUUID?: string;
	},
	browserID?: string,
	getNewBrowserIfNoResume: boolean = false,
	network: Network = 'residential',
	country: Country | undefined = TheGlobe.getCountryByCode('US'),
	useProxy: boolean = false,
	sessionData: string = '',
	isExtending: boolean = false,
): Promise<SessionInfo> {
	let payload: Record<string, unknown> = {
		sessionID: userID,
		leaseTime: leaseTime,
	};

	if (browserID) {
		payload['browserID'] = browserID;
	}

	if (clientID) {
		payload['clientID'] = clientID;
	}

	if (isDebug) {
		payload['isDebug'] = isDebug;
	}

	if (viewport) {
		payload['viewport'] = viewport;
	}

	if (extraData.sessionUUID) {
		payload['sessionUUID'] = extraData.sessionUUID;
	}

	if (useProxy) {
		payload['proxyServer'] = getProxyServerString();
		payload['proxyAuth'] = getBrightDataAuth(userID, {
			// 'residential' | 'datacenter' | 'isp' | 'isp-mexico'
			network: network,
			country: country,
		});
	}

	if (extraData.fingerprintID) {
		payload['fingerprintID'] = extraData.fingerprintID;
	}

	if (extraData.driver) {
		payload['driver'] = extraData.driver;
	}

	if (extraData.reportKey) {
		payload['reportKey'] = extraData.reportKey;
	}

	if (extraData.callbackURL) {
		payload['callbackURL'] = extraData.callbackURL;
	}

	if (sessionData !== '') {
		payload['sessionData'] = sessionData;
	}

	if (isExtending) {
		payload['isExtending'] = isExtending;
	}

	const attemptsNum = 10;
	let currentAttemptNum = 0;
	let resp: AxiosResponse<any> | null = null;
	while (currentAttemptNum < attemptsNum) {
		try {
			resp = await axios.post(
				`${process.env.BROWSER_POC_SERVICE}/getBrowser`,
				payload,
				{
					headers: {
						'Content-Type': 'application/json',
					},
				},
			);

			if (!resp || resp.data.success) {
				break;
			} else {
				const logCtx = {
					msg: '',
					userID: userID,
					payload,
					response: resp.data,
					currentAttemptNum,
				};

				if (getNewBrowserIfNoResume) {
					logCtx.msg = 'Failed to get a new browser for a user';
				} else {
					logCtx.msg = 'Failed to get an existing browser for a user';
				}
				if(logger) logger.error(logCtx, "browsers-cmgr:getSessionInfo:198");

				// handle the error, based on its type
				switch (resp.data.error?.type) {
					case BrowsersServiceErrType.BAD_REQUEST:
						return Promise.reject(GetStealthiumErrors.BAD_REQUEST);
					case BrowsersServiceErrType.INVALID_BROWSER_ID:
						return Promise.reject(
							GetStealthiumErrors.INVALID_BROWSER_ID,
						);
					case BrowsersServiceErrType.BROWSER_IN_USE:
						if (getNewBrowserIfNoResume) {
							delete payload['browserID'];
							break;
						} else {
							return Promise.reject(
								GetStealthiumErrors.BROWSER_IN_USE,
							);
						}
					case BrowsersServiceErrType.BROWSERS_BUSY:
						break;
					case BrowsersServiceErrType.UNKNOWN_ERROR:
						break;
					default:
						break;
				}
			}
		} catch (error) {
			const logCtx = {
				msg: 'Error requesting Stealthium from service',
				userID: userID,
				payload,
				response: {},
				error,
				currentAttemptNum,
			};

			if (resp) logCtx['response'] = resp.data;
			if(logger) logger.error(logCtx, "browsers-cmgr:getSessionInfo:237");
		}

		await new Promise((resolve) => setTimeout(resolve, 1000));
		currentAttemptNum++;
	}

	if (!resp?.data?.success) {
		const logCtx = {
			msg: 'Could not get a browser after multiple attempts',
			userID: userID,
			payload,
			response: resp ? resp.data : {},
			currentAttemptNum,
			attemptsNum,
		};
		if(logger) logger.error(logCtx, "browsers-cmgr:getSessionInfo:252");

		return Promise.reject(GetStealthiumErrors.MULTI_ATTEMPTS_ERROR);
	}

	const logCtx = {
		msg: 'User received a browser',
		userID: userID,
		browserID: resp.data?.id,
		url: resp.data?.url,
		currentAttemptNum,
	};

	if(logger) logger.info(logCtx, "browsers-cmgr:getSessionInfo:265");

	return Promise.resolve({
		sessionID: userID,
		browserID: resp.data?.id,
		appPort: resp.data?.appPort,
		wsPort: resp.data?.wsPort,
		vncPort: resp.data?.vncPort,
		vncPassword: resp.data.vncPassword || '',
		url: resp.data?.url,
	});
}

enum BrowsersServiceErrType {
	// non-retirable errors
	BAD_REQUEST = 'BAD_REQUEST', // missing userID, browserID, or failure to parse browserID
	INVALID_BROWSER_ID = 'INVALID_BROWSER_ID', // incorrect BrowserID pattern
	BROWSER_IN_USE = 'BROWSER_IN_USE', // browser is killed or assigned to someone else

	// retirable errors
	BROWSERS_BUSY = 'BROWSERS_BUSY', // no free browsers to assign for the user
	UNKNOWN_ERROR = 'UNKNOWN_ERROR', // failed to create a browser or test its connection
}

export const BrowsersServiceErr = {
	BAD_REQUEST: new Error(
		'missing userID, browserID, or failure to parse browserID',
	),
	INVALID_BROWSER_ID: new Error('incorrect BrowserID pattern'),
	BROWSER_IN_USE: new Error('browser is killed or assigned to someone else'),

	MULTI_ATTEMPTS_ERROR: new Error(
		'could not get a browser after multiple attempts',
	),

	// none of the following are returned actually, but here if we need to later
	BROWSERS_BUSY: new Error('no free browsers to assign for the user'),
	UNKNOWN_ERROR: new Error(
		'failed to create a browser or test its connection',
	),
	UNEXPECTED_ERROR: new Error(
		'failed to get the request browser for unexpected error',
	),
};

export const GetStealthiumErrors = {
	BAD_REQUEST: {
		type: 'BAD_REQUEST',
		message: 'missing userID, browserID, or failure to parse browserID',
	},
	INVALID_BROWSER_ID: {
		type: 'INVALID_BROWSER_ID',
		message: 'incorrect BrowserID pattern',
	},
	INVALID_USER_ID: {
		type: 'INVALID_USER_ID',
		message: 'userID is not present or is of invalid format',
	},
	BROWSER_IN_USE: {
		type: 'BROWSER_IN_USE',
		message: 'browser is killed or assigned to someone else',
	},
	MULTI_ATTEMPTS_ERROR: {
		type: 'MULTI_ATTEMPTS_ERROR',
		message: 'could not get a browser after multiple attempts',
	},
	// none of the following are returned actually, but here if we need to later
	BROWSERS_BUSY: {
		type: 'BROWSERS_BUSY',
		message: 'no free browsers to assign for the user',
	},
	UNKNOWN_ERROR: {
		type: 'UNKNOWN_ERROR',
		message: 'failed to create a browser or test its connection',
	},
	UNEXPECTED_ERROR: {
		type: 'UNEXPECTED_ERROR',
		message: 'failed to get the request browser for unexpected error',
	},
};
