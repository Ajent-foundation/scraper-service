import { Router } from 'express';
import multer from 'multer';
import invalidateSession from '../handlers/session/invalidateSession';
import getSession from '../handlers/session/getSession';
import createSession from '../handlers/session/createSession';
import getData from '../handlers/session/getData';
import setData from '../handlers/session/setData';
import download from '../handlers/session/download';
import listFiles from '../handlers/session/listFiles';
import downloadFile from '../handlers/session/downloadFile';
import uploadFile from '../handlers/session/uploadFile';
import extendSession from '../handlers/session/extendSession';

const SESSION_ROUTES = Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// The Routing Sheet
SESSION_ROUTES.post(
	'/createSession',
	upload.single('apk'),
	createSession,
);

SESSION_ROUTES.delete(
	'/:sessionID/invalidateSession',
	invalidateSession,
);

SESSION_ROUTES.post(
	'/:sessionID/extendSession',
	extendSession,
);

SESSION_ROUTES.get(
	'/:sessionID/info',
	getSession,
);

SESSION_ROUTES.get(
	'/:sessionID/data',
	getData,
);

SESSION_ROUTES.get(
	'/:sessionID/files',
	listFiles,
);

SESSION_ROUTES.post(
	'/:sessionID/set',
	setData,
);

SESSION_ROUTES.post(
	'/:sessionID/downloadFile',
	downloadFile,
);

SESSION_ROUTES.post(
	'/:sessionID/uploadFile',
	uploadFile,
);

SESSION_ROUTES.post(
	'/:sessionID/download',
	download,
);

export default SESSION_ROUTES;