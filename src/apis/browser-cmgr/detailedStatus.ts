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
    const response = await axios.get(`${process.env.BROWSER_POC_SERVICE}/detailedStatus`)
    return response.data
}