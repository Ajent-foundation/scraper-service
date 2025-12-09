import axios, { isAxiosError } from 'axios';
import { Logger } from 'pino';

export type CookieSourceScheme = 'Unset' | 'NonSecure' | 'Secure';

export type BrowserStorageData = Record<string, object>;

export type CookieParam = {
	name: string;
	value: string;
	domain?: string;
	expires?: number;
	httpOnly?: boolean;
	partitionKey?: string;
	path?: string;
	priority?: string;
	sameParty?: boolean;
	sameSite?: string;
	secure?: boolean;
	sourceScheme?: CookieSourceScheme;
	url?: string;
};

export type BrowserSessionData = {
	cookies: CookieParam[];
	localStorage: BrowserStorageData;
	sessionStorage: BrowserStorageData;
};

export async function getSessionData(
	logger: Logger, 
	headers: Record<string, string>,
	url: string
) {
	try {
		const response = await axios.get(
			`${url}/session/data`,
		);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_SESSION_DATA_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_SESSION_DATA_ERROR")
		}

		return Promise.reject('Failed to get data from browser-node');
	}
}

export async function setSessionData(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	data: BrowserSessionData,
) {
	try {
		const response = await axios.post(
			`${url}/session/set`,
			data,
			{
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			const axiosError = error as Error;
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "SET_SESSION_DATA_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "SET_SESSION_DATA_ERROR")
		}

		return Promise.reject('Failed to get data from browser-node');
	}
}

export async function downloadSessionData(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
): Promise<string> {
	try {
		const response = await axios.post(
			`${url}/session/download`,
			{},
			{
				headers: {
					'Content-Type': 'application/json',
				},
				responseType: 'arraybuffer',
			},
		);

		// Convert the response data to a Buffer
		const buffer = Buffer.from(response.data, 'binary');

		// Convert the Buffer to a base64 string
		const base64 = buffer.toString('base64');
		return base64;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			const axiosError = error as Error;
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "DOWNLOAD_SESSION_DATA_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "DOWNLOAD_SESSION_DATA_ERROR")
		}

		return Promise.reject('Error downloading session from browser-node');
	}
}

export async function listFiles(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	type: "upload" | "download"
): Promise<{files:string[]}> {
	try {
		const response = await axios.get(
			`${url}/files/list?type=${type}`,
			{
				headers: {
					'Content-Type': 'application/json',
				}
			},
		);

		if(response.status !== 200){
			throw new Error('Unexpected response from browser-node [listFiles]');
		}

		return {
			files: response.data.files
		}
	} catch (error: unknown) {
		const errMessage = 'Error getting files list from browser-node';
		if (isAxiosError(error)) {
			const axiosError = error as Error;
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "LIST_FILES_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "LIST_FILES_ERROR")
		}

		return Promise.reject(errMessage);
	}
}

export async function downloadFile(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	fileName: string,
){
	try {
		const response = await axios.post(
			`${url}/files/download/${fileName}`,
			{},
			{
				headers: {
					'Content-Type': 'application/json',
				},
				responseType: 'arraybuffer',
			},
		);

		if(response.status !== 200){
			throw new Error('Unexpected response from browser-node [downloadFile]');
		}

		// Convert the response data to a Buffer
		const buffer = Buffer.from(response.data, 'binary');

		// Convert the Buffer to a base64 string
		const base64 = buffer.toString('base64');
		return base64;
	} catch (error: unknown) {
		const errMessage = 'Error downloading file from browser-node';
		if (isAxiosError(error)) {
			const axiosError = error as Error;
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "DOWNLOAD_FILE_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "DOWNLOAD_FILE_ERROR")
		}

		return Promise.reject(errMessage);
	}
}

export async function uploadFile(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	base64File: string,
): Promise<{fileName:string}> {
	try {
		const fetchRes = await fetch(`data:application/octet-stream;base64,${base64File}`);
        const blob = await fetchRes.blob()

		// Create Form
		const form = new FormData()
		form.append('session', blob)

		const response = await axios.post(
			`${url}/files/upload`,
			form,
			{
				headers: {
					'Content-Type': 'multipart/form-data',
				}
			},
		);

		if(response.status !== 200){
			throw new Error('Unexpected response from browser-node [uploadFile]');
		}

		return response.data
	} catch (error: unknown) {
		const errMessage = 'Error uploading file from browser-node';
		if (isAxiosError(error)) {
			const axiosError = error as Error;
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "UPLOAD_FILE_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "UPLOAD_FILE_ERROR")
		}

		return Promise.reject(errMessage);
	}
}

export async function isBrowserActive(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
): Promise<{isBrowserActive:boolean, windowName:string}>{
	try {
		const response = await axios.get(
			`${url}/system/isBrowserActive`,
			{
				headers: {
					'Content-Type': 'application/json',
				}
			},
		);

		if(response.status !== 200){
			throw new Error('Unexpected response from browser-node [listFiles]');
		}

		return response.data
	} catch (error: unknown) {
		const errMessage = 'Error getting browser status from browser-node';
		if (isAxiosError(error)) {
			const axiosError = error as Error;
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "IS_BROWSER_ACTIVE_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "IS_BROWSER_ACTIVE_ERROR")
		}

		return Promise.reject(errMessage);
	}
}

export async function closeDialog(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
): Promise<void> {
	try {
		const response = await axios.post(
			`${url}/system/closeDialog`,
			{},
			{
				headers: {
					'Content-Type': 'application/json',
				}
			},
		);


		if(response.status !== 200){
			throw new Error('Unexpected response from browser-node [closeDialog]');
		}
	} catch (error: unknown) {
		const errMessage = 'Error downloading session from browser-node';
		if (isAxiosError(error)) {
			const axiosError = error as Error;
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "CLOSE_DIALOG_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "CLOSE_DIALOG_ERROR")
		}

		return Promise.reject(errMessage);
	}
}

export async function selectFileFromDialog(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	fileName: string,
): Promise<void> {
	try {
		const response = await axios.post(
			`${url}/system/selectFileFromDialog`,
			{
				fileName
			},
			{
				headers: {
					'Content-Type': 'application/json',
				}
			},
		);

		if(response.status !== 200){
			throw new Error('Unexpected response from browser-node [selectFileFromDialog]');
		}
	} catch (error: unknown) {
		const errMessage = 'Error downloading session from browser-node';
		if (isAxiosError(error)) {
			const axiosError = error as Error;
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "SELECT_FILE_FROM_DIALOG_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "SELECT_FILE_FROM_DIALOG_ERROR")
		}

		return Promise.reject(errMessage);
	}
}

// System endpoints for computer use functionality
export async function mouseControl(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	body: any,
): Promise<any> {
	try {
		const response = await axios.post(
			`${url}/system/mouse`,
			body,
			{
				headers: {
					'Content-Type': 'application/json',
				}
			},
		);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "MOUSE_CONTROL_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "MOUSE_CONTROL_ERROR")
		}
		return Promise.reject('Error controlling mouse from browser-node');
	}
}

export async function getMouseLocation(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
): Promise<any> {
	try {
		const response = await axios.get(`${url}/system/mouse/location`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_MOUSE_LOCATION_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_MOUSE_LOCATION_ERROR")
		}
		return Promise.reject('Error getting mouse location from browser-node');
	}
}

export async function getMouseState(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
): Promise<any> {
	try {
		const response = await axios.get(`${url}/system/mouse/state`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_MOUSE_STATE_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_MOUSE_STATE_ERROR")
		}
		return Promise.reject('Error getting mouse state from browser-node');
	}
}

export async function keyboardControl(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	body: any,
): Promise<any> {
	try {
		const response = await axios.post(
			`${url}/system/keyboard`,
			body,
			{
				headers: {
					'Content-Type': 'application/json',
				}
			},
		);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "KEYBOARD_CONTROL_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "KEYBOARD_CONTROL_ERROR")
		}
		return Promise.reject('Error controlling keyboard from browser-node');
	}
}

export async function getKeyboardState(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
): Promise<any> {
	try {
		const response = await axios.get(`${url}/system/keyboard/state`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_KEYBOARD_STATE_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_KEYBOARD_STATE_ERROR")
		}
		return Promise.reject('Error getting keyboard state from browser-node');
	}
}

export async function getClipboard(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
): Promise<any> {
	try {
		const response = await axios.get(`${url}/system/clipboard`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_CLIPBOARD_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_CLIPBOARD_ERROR")
		}
		return Promise.reject('Error getting clipboard from browser-node');
	}
}

export async function setClipboard(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	content: string,
): Promise<any> {
	try {
		const response = await axios.post(
			`${url}/system/clipboard`,
			{ content },
			{
				headers: {
					'Content-Type': 'application/json',
				}
			},
		);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "SET_CLIPBOARD_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "SET_CLIPBOARD_ERROR")
		}
		return Promise.reject('Error setting clipboard from browser-node');
	}
}

export async function getSystemScreenshot(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	quality?: number,
): Promise<any> {
	try {
		const query = quality ? `?quality=${quality}` : '';
		const response = await axios.get(`${url}/system/screenshot${query}`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_SYSTEM_SCREENSHOT_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_SYSTEM_SCREENSHOT_ERROR")
		}
		return Promise.reject('Error getting screenshot from browser-node');
	}
}

export async function scroll(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	body: any,
): Promise<any> {
	try {
		const response = await axios.post(
			`${url}/system/scroll`,
			body,
			{
				headers: {
					'Content-Type': 'application/json',
				}
			},
		);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "SCROLL_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "SCROLL_ERROR")
		}
		return Promise.reject('Error scrolling from browser-node');
	}
}

export async function drag(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	body: any,
): Promise<any> {
	try {
		const response = await axios.post(
			`${url}/system/drag`,
			body,
			{
				headers: {
					'Content-Type': 'application/json',
				}
			},
		);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "DRAG_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "DRAG_ERROR")
		}
		return Promise.reject('Error performing drag from browser-node');
	}
}

export async function getScreenSize(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
): Promise<any> {
	try {
		const response = await axios.get(`${url}/system/screen/size`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_SCREEN_SIZE_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_SCREEN_SIZE_ERROR")
		}
		return Promise.reject('Error getting screen size from browser-node');
	}
}

export async function executeShellCommand(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	command: string,
	timeout?: number,
): Promise<any> {
	try {
		const response = await axios.post(
			`${url}/system/shell`,
			{ command, timeout },
			{
				headers: {
					'Content-Type': 'application/json',
				}
			},
		);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "EXECUTE_SHELL_COMMAND_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "EXECUTE_SHELL_COMMAND_ERROR")
		}
		return Promise.reject('Error executing shell command from browser-node');
	}
}

export async function getWindows(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
): Promise<any> {
	try {
		const response = await axios.get(`${url}/system/windows`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_WINDOWS_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_WINDOWS_ERROR")
		}
		return Promise.reject('Error getting windows from browser-node');
	}
}

export async function controlWindow(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	body: any,
): Promise<any> {
	try {
		const response = await axios.post(
			`${url}/system/window/control`,
			body,
			{
				headers: {
					'Content-Type': 'application/json',
				}
			},
		);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "CONTROL_WINDOW_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "CONTROL_WINDOW_ERROR")
		}
		return Promise.reject('Error controlling window from browser-node');
	}
}

export async function getDevtoolsVersion(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	host?: string,
	port?: string,
): Promise<any> {
	try {
		const queryParams = new URLSearchParams();
		if (host) queryParams.append('host', host);
		if (port) queryParams.append('port', port);
		const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
		
		const response = await axios.get(`${url}/system/devtools/version${query}`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_DEVTOOLS_VERSION_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_DEVTOOLS_VERSION_ERROR")
		}
		return Promise.reject('Error getting devtools version from browser-node');
	}
}

// Recording endpoints
export async function getRecordingActions(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	sessionId?: string,
	type?: string,
	limit?: number,
): Promise<any> {
	try {
		const queryParams = new URLSearchParams();
		if (sessionId) queryParams.append('sessionId', sessionId);
		if (type) queryParams.append('type', type);
		if (limit) queryParams.append('limit', String(limit));
		const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
		
		const response = await axios.get(`${url}/recording/actions${query}`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_RECORDING_ACTIONS_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_RECORDING_ACTIONS_ERROR")
		}
		return Promise.reject('Error getting recording actions from browser-node');
	}
}

export async function getRecordingNetwork(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	sessionId?: string,
	urlFilter?: string,
	method?: string,
	limit?: number,
): Promise<any> {
	try {
		const queryParams = new URLSearchParams();
		if (sessionId) queryParams.append('sessionId', sessionId);
		if (urlFilter) queryParams.append('url', urlFilter);
		if (method) queryParams.append('method', method);
		if (limit) queryParams.append('limit', String(limit));
		const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
		
		const response = await axios.get(`${url}/recording/network${query}`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_RECORDING_NETWORK_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_RECORDING_NETWORK_ERROR")
		}
		return Promise.reject('Error getting recording network from browser-node');
	}
}

export async function getRecordingCdp(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	sessionId?: string,
	method?: string,
	direction?: string,
	limit?: number,
): Promise<any> {
	try {
		const queryParams = new URLSearchParams();
		if (sessionId) queryParams.append('sessionId', sessionId);
		if (method) queryParams.append('method', method);
		if (direction) queryParams.append('direction', direction);
		if (limit) queryParams.append('limit', String(limit));
		const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
		
		const response = await axios.get(`${url}/recording/cdp${query}`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_RECORDING_CDP_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_RECORDING_CDP_ERROR")
		}
		return Promise.reject('Error getting recording CDP events from browser-node');
	}
}

export async function getRecordingRaw(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	type: string,
	sessionId?: string,
): Promise<any> {
	try {
		const queryParams = new URLSearchParams();
		if (sessionId) queryParams.append('sessionId', sessionId);
		const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
		
		const response = await axios.get(`${url}/recording/raw/${type}${query}`);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				data: error.response?.data,
			}, "GET_RECORDING_RAW_ERROR")
		} else {
			logger.error({
				...headers,
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			}, "GET_RECORDING_RAW_ERROR")
		}
		return Promise.reject('Error getting recording raw data from browser-node');
	}
}
