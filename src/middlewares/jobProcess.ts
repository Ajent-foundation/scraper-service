import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import NodeCache from 'node-cache';
import {
	BaseSession,
	Job,
	getSessionInfo,
	BrowserSession,
} from '../apis/browsers-cmgr';
import UTILITY from '../helpers/utility';
import { detailedStatus, IDetailedStatusResponse } from '../apis/browser-cmgr/detailedStatus';

export async function preProcess(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const cache: NodeCache = res.locals.cache;

	let sessionID: string;
	let session: BaseSession;

	// Has sessionID
	let hasRunningSession: boolean = false;
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

	if (req.body.sessionID) {
		sessionID = req.body.sessionID;

		// check if session still exists as a browser
		const browser = cmgrState.browsers.find((b)=> b.sessionID === sessionID)
		session = cache.get(sessionID)

		if (browser) {
			if(!session){
				// Recover cache session
				cache.set(sessionID, {
					sessionID: sessionID,
					browserID: browser.labels.id,
					leaseTime: browser.leaseTime,
					url: `http://${browser.labels.ip}:${browser.ports.browser}`,
					isDebug: browser.isDebug,
					vncPassword: browser.vncPassword,
					viewport: browser.viewport,
					wsPort: browser.ports.browser,
					vncPort: browser.ports.vnc,
					appPort: browser.ports.app,
					type: "browser",
					jobs: [],
				}, res.locals.cacheTimeout)
			}

			hasRunningSession = true;
		} else {
			if(!session){
				UTILITY.EXPRESS.respond(res, 400, {
					code: 'SESSION_INVALID',
					message: 'Session Invalid',
				});
				return;
			}
		}
	}

	if (hasRunningSession) {
		try {
			// Note do we need to refresh it ?
			if (session.type === "browser") {
				await getSessionInfo(
					res.log,
					undefined,
					(session as BrowserSession).leaseTime,
					undefined,
					undefined,
					sessionID,
					{},
					(session as BrowserSession).browserID,
					false,
				);
			}

			// Update session
			cache.set(sessionID, session, res.locals.cacheTimeout);
		} catch (error) {
			UTILITY.EXPRESS.respond(res, 400, {
				code: 'SESSION_EXPIRED',
				message: 'Session Expired',
			});
			return;
		}
	} else {
		UTILITY.EXPRESS.respond(res, 400, {
			code: 'SESSION_INVALID',
			message: 'Session Invalid',
		});
		return
	}

	// Validate No Operation is running
	let ms = 0;
	while (session.jobs.length > 0) {
		await new Promise((resolve) => setTimeout(resolve, 1000));
		ms = ms + 1000;
		if (ms > res.locals.timeout) {
			UTILITY.EXPRESS.respond(res, 400, {
				code: 'TIMEOUT',
				message: 'Operation timed out',
			});
			return;
		} else {
			cache.get(sessionID);
			continue;
		}
	}

	// Create new Job
	const jobID = uuidv4();
	const job: Job = {
		jobID: jobID,
		endpoint: req.path,
	};
	res.locals.jobID = jobID;
	session.jobs.push(job);

	res.locals.cache.set(sessionID, session, res.locals.cacheTimeout);
	res.log.info({
		job:  `ID-${req.path}:${sessionID}:${jobID}`
	}, "JOB_PROCESSING");

	res.locals.sessionID = sessionID;
	next();
}

export async function postProcess(req: Request, res: Response) {
	const cache: NodeCache = res.locals.cache;

	const session: BaseSession = cache.get(res.locals.sessionID);
	if (session) {
		res.log.info({
			job:  `ID-${req.path}:${res.locals.sessionID}:${res.locals.jobID}`
		}, "JOB_COMPLETED");

		// Find And remove Job
		let jobFound = false;
		for (let i = 0; i < session.jobs.length; i++) {
			if (session.jobs[i].jobID == res.locals.jobID) {
				session.jobs.splice(i, 1);
				jobFound = true;
				break;
			}
		}

		if (jobFound) {
			res.log.info({
				job:  `ID-${req.path}:${res.locals.sessionID}:${res.locals.jobID}`
			}, "JOB_REMOVED");	
		} else {
			res.log.error({
				job:  `ID-${req.path}:${res.locals.sessionID}:${res.locals.jobID}`
			}, "JOB_NOT_FOUND");
		}

		// Update Session
		cache.set(res.locals.sessionID, session, res.locals.cacheTimeout);
	}
}
