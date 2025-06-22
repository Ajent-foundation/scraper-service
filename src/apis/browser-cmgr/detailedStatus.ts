import axios from "axios"

interface BrowserPorts {
    vnc: number;
    app: number;
    browser: number;
}

interface BrowserLabels {
    id: string;
    ip: string;
    status: string;
    wsPath: string;
}

interface BrowserInstance {
    name: string;
    index: number;
    isUp: boolean;
    isRemoving: boolean;
    lastUsed: number;
    createdAt: number;
    leaseTime: number;
    vncPassword: string;
    ports: BrowserPorts;
    labels: BrowserLabels;
    isDebug?: boolean;
	viewport: {
        width: number
        height: number
    };
    webhook: string;
    sessionID: string;
    clientID: string;
    fingerprintID: string;
}

export interface IDetailedStatusResponse {
    success: boolean;
    capacity: string;
    used: number;
    browsers: BrowserInstance[];
}

export async function detailedStatus(): Promise<IDetailedStatusResponse> {
    let attempts = 0;
    const maxAttempts = 3;
    const delayMs = 1000;

    while (attempts < maxAttempts) {
        try {
            const response = await axios.get(`${process.env.BROWSER_POC_SERVICE}/detailedStatus`);
            return response.data;
        } catch (error) {
            attempts++;
            if (attempts === maxAttempts) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    // TypeScript requires a return here even though it's unreachable
    throw new Error('Failed to get detailed status after max attempts');
}