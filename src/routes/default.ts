import { Router } from 'express';
import { Request, Response } from 'express';
import UTILITY from '../helpers/utility';

const DEFAULT_ROUTES = Router();

// The Routing Sheet
DEFAULT_ROUTES.get('/', (req: Request, res: Response) => {
	res.locals.httpInfo.status_code = 200;
	return UTILITY.EXPRESS.respond(res, 200, {
		message: 'scraper-service-ts is running!',
	});
});

export default DEFAULT_ROUTES;
