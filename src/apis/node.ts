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

export async function getSessionData(logger: Logger, url: string) {
	try {
		const response = await axios.get(
			`${url}/session/data`,
		);
		return response.data;
	} catch (error: unknown) {
		if (isAxiosError(error)) {
			const axiosError = error as Error;
			logger.error(
				{
					message: 'Error getting data from browser-node',
					error: axiosError.message,
					stack: axiosError.stack,
				},
				"node:getSessionData"
			);
		} else {
			logger.error(
				{
					message: 'Error getting data from browser-node',
				},
				"node:getSessionData"
			);
		}

		return Promise.reject('Failed to get data from browser-node');
	}
}

export async function setSessionData(
	logger: Logger,
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
			logger.error(
				{
					message: 'Error getting data from browser-node',
					error: axiosError.message,
					stack: axiosError.stack,
				},
				"node:setSessionData"
			);
		} else {
			logger.error(
				{
					message: 'Error getting data from browser-node',
				},
				"node:setSessionData"
			);
		}

		return Promise.reject('Failed to get data from browser-node');
	}
}

export async function downloadSessionData(
	logger: Logger,
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
			logger.error(
				{
					message: 'Error downloading session from browser-node',
					error: axiosError.message,
					stack: axiosError.stack,
				},
				"node:downloadSessionData"
			);
		} else {
			logger.error(
				{
					message: 'Error downloading session from browser-node',
				},
				"node:downloadSessionData"
			);
		}

		return Promise.reject('Error downloading session from browser-node');
	}
}

export async function listFiles(
	logger: Logger,
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
			logger.error(
				{
					message: errMessage,
					error: axiosError.message,
					stack: axiosError.stack,
				},
				"node:listFiles"
			);
		} else {
			logger.error(
				{
					message: errMessage,
				},
				"node:listFiles"
			);
		}

		return Promise.reject(errMessage);
	}
}

export async function downloadFile(
	logger: Logger,
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
			logger.error(
				{
					message: errMessage,
					error: axiosError.message,
					stack: axiosError.stack,
				},
				"node:downloadFile"
			);
		} else {
			logger.error(
				{
					message: errMessage,
				},
				"node:downloadFile"
			);
		}

		return Promise.reject(errMessage);
	}
}

export async function uploadFile(
	logger: Logger,
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
			logger.error(
				{
					message: errMessage,
					error: axiosError.message,
					stack: axiosError.stack,
				},
				"node:uploadFile"
			);
		} else {
			logger.error(
				{
					message: errMessage,
				},
				"node:uploadFile"
			);
		}

		return Promise.reject(errMessage);
	}
}

export async function isBrowserActive(
	logger: Logger,
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
			logger.error(
				{
					message: errMessage,
					error: axiosError.message,
					stack: axiosError.stack,
				},
				"node:isBrowserActive"
			);
		} else {
			logger.error(
				{
					message: errMessage,
				},
				"node:isBrowserActive"
			);
		}

		return Promise.reject(errMessage);
	}
}

export async function closeDialog(
	logger: Logger,
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
			logger.error(
				{
					message: errMessage,
					error: axiosError.message,
					stack: axiosError.stack,
				},
				"node:closeDialog"
			);
		} else {
			logger.error(
				{
					message: errMessage,
				},
				"node:closeDialog"
			);
		}

		return Promise.reject(errMessage);
	}
}

export async function selectFileFromDialog(
	logger: Logger,
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
			logger.error(
				{
					message: errMessage,
					error: axiosError.message,
					stack: axiosError.stack,
				},
				"node:selectFileFromDialog"
			);
		} else {
			logger.error(	
				{
					message: errMessage,
				},
				"node:selectFileFromDialog"
			);
		}

		return Promise.reject(errMessage);
	}
}