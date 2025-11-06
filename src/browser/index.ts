import puppeteer, { Browser } from 'puppeteer';
import { BrowserConfig } from '../apis/browsers-cmgr';
import { Logger } from 'pino';
import axios from 'axios';

export const VIEW_PORT = {
	width: 1280,
	height: 720,
};

export type TBrowserSettings = {
	isDebug: boolean;
	viewport: {
		width: number;
		height: number;
		deviceScaleFactor?: number;
	};
};

const CONNECT_MAX_ATTEMPTS = 3;
const CONNECT_ATTEMPT_DELAY = 1000;

// Browser connection cache
interface BrowserConnection {
	browser: Browser;
	url: string;
	sessionID: string;
	lastUsed: number;
	isConnected: boolean;
	disconnectHandler?: () => void;
}

class BrowserConnectionManager {
	private connections: Map<string, BrowserConnection> = new Map();
	private readonly CONNECTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
	private cleanupInterval: NodeJS.Timeout;

	constructor() {
		// Clean up stale connections every 5 minutes
		this.cleanupInterval = setInterval(() => {
			this.cleanupStaleConnections();
		}, 5 * 60 * 1000);
	}

	private getConnectionKey(url: string, sessionID: string): string {
		return `${url}:${sessionID}`;
	}

	private async cleanupStaleConnections() {
		const now = Date.now();
		for (const [key, connection] of this.connections.entries()) {
			if (now - connection.lastUsed > this.CONNECTION_TIMEOUT) {
				try {
					// Remove event listener
					if (connection.disconnectHandler) {
						connection.browser.off('disconnected', connection.disconnectHandler);
					}
					
					if (connection.browser && connection.isConnected) {
						await connection.browser.close();
					}
				} catch (error) {
					// Ignore errors when closing stale connections
				}
				this.connections.delete(key);
			}
		}
	}

	private async isConnectionAlive(browser: Browser): Promise<boolean> {
		try {
			// Try to get browser version to test if connection is alive
			await browser.version();
			return true;
		} catch (error) {
			return false;
		}
	}

	async getConnection(logger: Logger, headers: Record<string, string>, url: string, sessionID: string, appPort?: number): Promise<Browser> {
		const connectionKey = this.getConnectionKey(url, sessionID);
		const existing = this.connections.get(connectionKey);
		
		// Check if we have a cached connection and if it's still alive
		if (existing && existing.isConnected) {
			const isAlive = await this.isConnectionAlive(existing.browser);
			if (isAlive) {
				logger.info(`Reusing existing browser connection for ${url} (session: ${sessionID})`);
				existing.lastUsed = Date.now();
				return existing.browser;
			} else {
				logger.info(`Cached connection for ${url} (session: ${sessionID}) is dead, removing from cache`);
				// Clean up dead connection
				if (existing.disconnectHandler) {
					existing.browser.off('disconnected', existing.disconnectHandler);
				}
				this.connections.delete(connectionKey);
			}
		}

		// Create new connection
		logger.info(`Creating new browser connection for ${url} (session: ${sessionID})`);
		const browser = await this.createNewConnection(logger, headers, url, appPort);
		
		// Simple disconnect handler
		const disconnectHandler = () => {
			logger.info(`Browser connection for ${url} (session: ${sessionID}) disconnected`);
			const connection = this.connections.get(connectionKey);
			if (connection) {
				connection.isConnected = false;
			}
		};

		// Set up disconnect handler
		browser.on('disconnected', disconnectHandler);
		
		// Cache the new connection
		this.connections.set(connectionKey, {
			browser,
			url,
			sessionID,
			lastUsed: Date.now(),
			isConnected: true,
			disconnectHandler
		});

		return browser;
	}

	private async createNewConnection(logger: Logger, headers: Record<string, string>, url: string, appPort?: number): Promise<Browser> {
		let puppeteerBrowser: Browser;
		
		// Check if we're connecting via container hostname (Docker mode)
		// URL format: http://container-name:port
		const urlObj = new URL(url);
		const isContainerHostname = urlObj.hostname.includes('instance-') || urlObj.hostname.includes('browser-node');
		const baasEnabled = process.env.BAAS_ENABLED === "true";
		
		logger.info({
			hostname: urlObj.hostname,
			isContainerHostname,
			baasEnabled,
			url,
			appPort
		}, 'Checking connection method');
		
		let connectionOptions: { browserWSEndpoint?: string; browserURL?: string; defaultViewport: null };
		
		if (isContainerHostname && !baasEnabled) {
			// In Docker mode, use browser-node's /system/devtools/version endpoint to get WebSocket URL
			// This avoids Chrome's Host header security check
			try {
				const hostname = urlObj.hostname;
				const browserPort = urlObj.port;
				// Use provided appPort or calculate it (7070 for 10222, 7071 for 10223)
				const calculatedAppPort = appPort || (parseInt(browserPort) - 3152);
				const devtoolsVersionUrl = `http://${hostname}:${calculatedAppPort}/system/devtools/version`;
				
				logger.info(`Getting WebSocket URL from ${devtoolsVersionUrl}`);
				const response = await axios.get(devtoolsVersionUrl, { timeout: 3000 });
				
				if (response.data?.webSocketDebuggerUrl) {
					// Extract path from original WebSocket URL (e.g., /devtools/browser/uuid)
					const originalUrl = new URL(response.data.webSocketDebuggerUrl);
					const wsPath = originalUrl.pathname;
					// Build WebSocket URL using container hostname and browser port
					const wsUrl = `ws://${hostname}:${browserPort}${wsPath}`;
					
					logger.info(`Using WebSocket endpoint: ${wsUrl}`);
					connectionOptions = {
						browserWSEndpoint: wsUrl,
						defaultViewport: null,
					};
				} else {
					throw new Error('webSocketDebuggerUrl not found in devtoolsVersion response');
				}
			} catch (error) {
				logger.warn({
					error: error instanceof Error ? error.message : 'Unknown error',
					stack: error instanceof Error ? error.stack : undefined,
					url,
				}, 'Failed to get WebSocket URL, falling back to browserURL');
				// Fall back to browserURL
				connectionOptions = {
					browserURL: url,
					defaultViewport: null,
				};
			}
		} else {
			// Use standard connection method
			connectionOptions = process.env.BAAS_ENABLED === "true" ? {
				browserWSEndpoint: url,
				defaultViewport: null,
			} : {
				browserURL: url,
				defaultViewport: null,
			};
		}
		
		for (let i = 0; i < CONNECT_MAX_ATTEMPTS; i++) {
			try {
				logger.info(`Connecting to browser at ${url} attempt ${i + 1}`);
				puppeteerBrowser = (await Promise.race([
					puppeteer.connect(connectionOptions),
					new Promise((_, reject) => {
						setTimeout(
							() => reject(new Error('Connection timeout')),
							10000, // Increased timeout to 10 seconds
						);
					}),
				])) as Browser;
				logger.info(`Connected to browser at ${url} after ${i + 1} attempts`);
				break;
			} catch (e) {
				if (i == CONNECT_MAX_ATTEMPTS - 1) {
					throw e;
				}
				await new Promise((resolve) =>
					setTimeout(resolve, CONNECT_ATTEMPT_DELAY),
				);
			}
		}

		return puppeteerBrowser;
	}

	async closeAllConnections() {
		for (const [key, connection] of this.connections.entries()) {
			try {
				// Remove event listener
				if (connection.disconnectHandler) {
					connection.browser.off('disconnected', connection.disconnectHandler);
				}
				
				if (connection.browser && connection.isConnected) {
					await connection.browser.close();
				}
			} catch (error) {
				// Ignore errors when closing
			}
		}
		this.connections.clear();
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
	}

	getConnectionCount(): number {
		return this.connections.size;
	}

	getConnectionInfo(): Array<{url: string, sessionID: string, lastUsed: Date, isConnected: boolean}> {
		return Array.from(this.connections.entries()).map(([key, connection]) => ({
			url: connection.url,
			sessionID: connection.sessionID,
			lastUsed: new Date(connection.lastUsed),
			isConnected: connection.isConnected
		}));
	}

	// Get connections for a specific session
	getSessionConnections(sessionID: string): Array<{url: string, lastUsed: Date, isConnected: boolean}> {
		return Array.from(this.connections.entries())
			.filter(([key, connection]) => connection.sessionID === sessionID)
			.map(([key, connection]) => ({
				url: connection.url,
				lastUsed: new Date(connection.lastUsed),
				isConnected: connection.isConnected
			}));
	}

	// Close all connections for a specific session
	async closeSessionConnections(sessionID: string) {
		const keysToDelete: string[] = [];
		for (const [key, connection] of this.connections.entries()) {
			if (connection.sessionID === sessionID) {
				try {
					// Remove event listener
					if (connection.disconnectHandler) {
						connection.browser.off('disconnected', connection.disconnectHandler);
					}
					
					if (connection.browser && connection.isConnected) {
						await connection.browser.close();
					}
				} catch (error) {
					// Ignore errors when closing
				}
				keysToDelete.push(key);
			}
		}
		keysToDelete.forEach(key => this.connections.delete(key));
	}
}

// Global instance
const browserManager = new BrowserConnectionManager();

export async function connectToBrowser(
	logger: Logger,
	headers: Record<string, string>,
	url: string,
	sessionID: string,
	appPort?: number
): Promise<Browser> {
	const browser = await browserManager.getConnection(logger, headers, url, sessionID, appPort);
	logger.info({
		message: "Connected to browser",
		url,
		sessionID,
	}, "INFO")
	return browser;
}

// Export manager for advanced usage
export { browserManager };

// Graceful shutdown
process.on('SIGTERM', async () => {
	await browserManager.closeAllConnections();
});

process.on('SIGINT', async () => {
	await browserManager.closeAllConnections();
});

export async function getBrowserSettings(
	config: BrowserConfig,
): Promise<TBrowserSettings> {
	// Viewport
	let viewPort = VIEW_PORT;
	if (config.viewport) {
		viewPort = config.viewport;
	}

	return {
		isDebug: config.isDebug ? config.isDebug : false,
		viewport: viewPort,
	};
}
