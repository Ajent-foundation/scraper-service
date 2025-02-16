import { Router } from 'express';
import { Request, Response } from 'express';
import UTILITY from '../helpers/utility';

const DEFAULT_ROUTES = Router();

// The Routing Sheet
DEFAULT_ROUTES.get('/', (req: Request, res: Response) => {
	// Init vars
	return UTILITY.EXPRESS.respond(res, 200, {
		message: 'Scraper-service-ts is running!',
	});
});

export default DEFAULT_ROUTES;
