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