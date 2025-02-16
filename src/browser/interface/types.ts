import { Action } from '../../handlers/page/executeCommands';

export enum mouseButton {
	Left = 'left',
	Right = 'right',
	Middle = 'middle',
}

export enum GetElmsType {
	BySimplifyingDom = 'BySimplifyingDom',
	BySegmentation = 'BySegmentation',
	ByCoords = 'ByCoords',
	BySnapshot = 'BySnapshot',
}

export type GetRepeatedElmsCommand = {
	action: Action.GetRepeatedElmsCommand;
	elmsCoords: { x: number; y: number; tagName: string }[];
	propertiesToCheck: {
		tagName: boolean;
		parent: boolean;
		className: boolean;
		backgroundColor: boolean;
		x: boolean;
		y: boolean;
		width: boolean;
		height: boolean;
		color: boolean;
		text: boolean;
		src: boolean;
		href: boolean;
		fontSize: boolean;
		fontWeight: boolean;
	};
};

export type GetRepeatedElmsByXpathCommand = {
	action: Action.GetRepeatedElmsByXpathCommand;
	elmsCoords: { x: number; y: number; tagName: string }[];
};

export type HoverCommand = {
	action: Action.Hover;
	x: number;
	y: number;
};

export type SmartClickCommand = {
	action: Action.Click;
	x: number;
	y: number;
	clickCount: number;
	button: mouseButton;
};

export type ClickCommand = {
	action: Action.Click;
	x: number;
	y: number;
	clickCount: number;
	button: mouseButton;
};

export type CheckBoxCommand = {
	action: Action.CheckBox;
	x: number;
	y: number;
	checked: boolean;
};

export type TypeInputCommand = {
	action: Action.TypeInput;
	x: number;
	y: number;
	input: string;
};

export type SelectCommand = {
	action: Action.Select;
	x: number;
	y: number;
	value: string;
};

export type DelayCommand = {
	action: Action.Delay;
	delay: number;
};

export type GetSelectOptions = {
	action: Action.GetSelectOptions;
	x: number;
	y: number;
};

export type GetElms = {
	action: Action.GetElms;
	type: GetElmsType;
	elms?: Elem[];
	fullPage?: boolean;
};

export type Elem = {
	x: number;
	y: number;
	width: number;
	height: number;
	text?: string;
};

export type ScrollAtPosition = {
	action: Action.ScrollAtPosition;
	axis: 'up' | 'down';
	x: number;
	y: number;
	factor: number;
};

export type FullScreenshot = {
	action: Action.FullScreenshot;
	fullPage: boolean;
};

export type ScreenShot = {
	action: Action.ScreenShot;
	x: number;
	y: number;
	width: number;
	height: number;
};

export type ScrollTop = {
	action: Action.ScrollTop;
};

export type ScrollBottom = {
	action: Action.ScrollBottom;
};

export type ScrollTo = {
	action: Action.ScrollTo;
	x: number;
	y: number;
};

export type ScrollNext = {
	action: Action.ScrollNext;
};

export type SmartClick = {
	action: Action.SmartClick;
	x: number;
	y: number;
	clickCount: number;
	button: mouseButton;
};

export type InjectJavascript = {
	action: Action.InjectJavascript;
	code: string;
	wait: boolean;
};

export type CustomAction = {
	action: Action.CustomAction;
	pass: string;
	code: string;
};

export enum LanguageEnum {
	en = 'en',
	fr = 'fr',
	de = 'de',
	el = 'el',
	pt = 'pt',
	ru = 'ru',
}

export type CloseDialog = {
	action: Action.CloseDialog;
};

export type IsDialogOpen = {
	action: Action.IsDialogOpen;
};

export type SelectFileFromDialog = {
	action: Action.SelectFileFromDialog;
	fileName: string;
};
