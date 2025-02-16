import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export async function logger(req: Request, res: Response, next: NextFunction) {
	const requestId = uuidv4();
	const startTime = Date.now();

	res.locals.httpInfo = {
		url: req.url,
		method: req.method,
		status_code: 0,
		request_id: requestId,
		version: 'v1',
	};

	res.locals.generalInfo = {
		startTime: startTime,
	};

	next();
}
