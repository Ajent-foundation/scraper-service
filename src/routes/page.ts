import { Router } from 'express';
import goToPage from '../handlers/page/goToPage';
import executeCommands from '../handlers/page/executeCommands';
import getWindowInfo from '../handlers/page/getWindowInfo';
import getOuterHTML from '../handlers/page/getOuterHTML';
import getCursorStyle from '../handlers/page/getCursorStyle';
import getBase64 from '../handlers/page/getBase64';
import parseToJSON from '../handlers/page/parse';
import getPagesInfo from '../handlers/page/getPagesInfo';
import newPage from '../handlers/page/newPage';
import switchPage from '../handlers/page/switchPage';
import closePage from '../handlers/page/closePage';
import pdf from '../handlers/page/pdf';
import extractMarkdown from '../handlers/page/extractMarkdown';
import { preProcess, postProcess } from '../middlewares/jobProcess';
import goBack from '../handlers/page/goBack';

const PAGE_ROUTES = Router();

// The Routing Sheet
PAGE_ROUTES.post(
	'/goToPage',
	preProcess,
	goToPage,
	postProcess,
);

PAGE_ROUTES.post(
	'/goBack',
	preProcess,
	goBack,
	postProcess,
);

PAGE_ROUTES.post(
	'/getPagesInfo',
	preProcess,
	getPagesInfo,
	postProcess,
);

PAGE_ROUTES.post(
	'/newPage',
	preProcess,
	newPage,
	postProcess,
);

PAGE_ROUTES.post(
	'/switchPage',
	preProcess,
	switchPage,
	postProcess,
);

PAGE_ROUTES.post(
	'/closePage',
	preProcess,
	closePage,
	postProcess,
);

PAGE_ROUTES.post(
	'/executeCommands',
	preProcess,
	executeCommands,
	postProcess,
);

PAGE_ROUTES.post(
	'/getWindowInfo',
	preProcess,
	getWindowInfo,
	postProcess,
);

PAGE_ROUTES.post(
	'/getOuterHTML',
	preProcess,
	getOuterHTML,
	postProcess,
);

PAGE_ROUTES.post(
	'/getCursorStyle',
	preProcess,
	getCursorStyle,
	postProcess,
);

PAGE_ROUTES.post(
	'/getBase64',
	preProcess,
	getBase64,
	postProcess,
);

PAGE_ROUTES.post(
	'/markdown',
	preProcess,
	extractMarkdown,
	postProcess,
)

PAGE_ROUTES.post(
	'/parse',
	preProcess,
	parseToJSON,
	postProcess,
);

PAGE_ROUTES.post(
	'/pdf',
	preProcess,
	pdf,
	postProcess,
);

export default PAGE_ROUTES;