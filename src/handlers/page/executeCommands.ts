import { Request, Response, NextFunction } from 'express';
import { BaseRequest } from '../../helpers/Base';
import UTILITY from '../../helpers/utility';
import { executeBrowserCommands } from '../../browser/interface';
import {
	DelayCommand,
	HoverCommand,
	ClickCommand,
	CheckBoxCommand,
	GetRepeatedElmsByXpathCommand,
	TypeInputCommand,
	SelectCommand,
	GetSelectOptions,
	GetElms,
	FullScreenshot,
	GetRepeatedElmsCommand,
	ScreenShot,
	ScrollTop,
	ScrollBottom,
	ScrollTo,
	ScrollNext,
	SmartClick,
	InjectJavascript,
	CustomAction,
	ScrollAtPosition,
	IsDialogOpen,
	CloseDialog,
	SelectFileFromDialog,
} from '../../browser/interface/types';
import NodeCache from 'node-cache';
import { BaseSession } from '../../apis/browsers-cmgr';
import { KeyInput } from 'puppeteer';
import { z } from 'zod';

export enum Action {
	Hover = 'Hover',
	Click = 'Click',
	SmartClick = 'SmartClick',
	CheckBox = 'CheckBox',
	TypeInput = 'TypeInput',
	Select = 'Select',
	Delay = 'Delay',
	GetSelectOptions = 'GetSelectOptions',
	GetElms = 'GetElms',
	FullScreenshot = 'FullScreenshot',
	ScreenShot = 'ScreenShot',
	ScrollTop = 'ScrollTop',
	ScrollBottom = 'ScrollBottom',
	ScrollTo = 'ScrollTo',
	ScrollNext = 'ScrollNext',
	InjectJavascript = 'InjectJavascript',
	CustomAction = 'CustomAction',
	GetRepeatedElmsCommand = 'GetRepeatedElmsCommand',
	GetRepeatedElmsByXpathCommand = 'GetRepeatedElmsByXpathCommand',
	ScrollAtPosition = 'ScrollAtPosition',
	KeyPress = 'KeyPress',
	SystemScreenshot = 'SystemScreenshot',
	// System actions (Browser-node)
	CloseDialog = 'CloseDialog',
	IsDialogOpen = 'IsDialogOpen',
	SelectFileFromDialog = 'SelectFileFromDialog',
}

export type KeyPress = {
	action: Action.KeyPress;
	key: KeyInput;
};


export type SystemScreenshot = {
	action: Action.SystemScreenshot;
};

export type Command =
	| DelayCommand
	| HoverCommand
	| ClickCommand
	| CheckBoxCommand
	| GetRepeatedElmsByXpathCommand
	| TypeInputCommand
	| SelectCommand
	| GetSelectOptions
	| GetElms
	| FullScreenshot
	| GetRepeatedElmsCommand
	| ScreenShot
	| ScrollTop
	| ScrollBottom
	| ScrollTo
	| ScrollNext
	| SmartClick
	| InjectJavascript
	| CustomAction
	| ScrollAtPosition
	| IsDialogOpen
	| CloseDialog
	| SelectFileFromDialog
	| KeyPress
	| SystemScreenshot

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>().and(
	z.object({
		commands: z.array(z.custom<Command>()),
	})
);

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function executeCommands(
	req: Request<RequestQuery, {}, RequestBody, RequestQuery>,
	res: Response,
	next: NextFunction,
) {
	// InitVars
	const commands = req.body.commands;
	const cache: NodeCache = res.locals.cache;
	let baseSession = cache.get(res.locals.sessionID) as BaseSession;
	let isMobileSession = baseSession.type === 'mobile';

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
		const isAllBrowserCommands = commands.every(
			(command) => !command.action.startsWith('Mobile'),
		);

		if (!isAllBrowserCommands) {
			UTILITY.EXPRESS.respond(res, 400, {
				code: 'BAD_REQUEST',
				message:
					'Browser session must contain only Browser commands.',
			});
			next();
			return;
		}

		await executeBrowserCommands(req, res, next);
	} catch (err) {
		console.log('Execute commands error:', err);

		// log Error
		res.log.error({
			message: err.message,
			stack: err.stack,
			startTime: res.locals.generalInfo.startTime,
		}, "page:executeCommands:209");

		UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}

	// Move to next function
	next();
}

export default executeCommands;
