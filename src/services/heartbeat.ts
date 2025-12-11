import axios from 'axios'
import { detailedStatus } from '../apis/browser-cmgr/detailedStatus'
import { Logger } from 'pino'

let heartbeatInterval: NodeJS.Timeout | null = null

const GCP_METADATA_URL = 'http://metadata.google.internal/computeMetadata/v1'
const METADATA_HEADERS = { 'Metadata-Flavor': 'Google' }

interface HeartbeatConfig {
    braasUrl: string      // BRaas Supabase URL (e.g., https://xxx.supabase.co)
    heartbeatKey: string  // Shared API key for authentication
    instanceName: string  // This VM's instance name
    intervalMs?: number   // Heartbeat interval (default: 60000 = 1 min)
}

/**
 * Fetch a value from GCP instance metadata
 * Returns null if not available (not on GCP or metadata not set)
 */
async function getGCPMetadata(key: string): Promise<string | null> {
    try {
        const response = await axios.get(
            `${GCP_METADATA_URL}/instance/attributes/${key}`,
            { headers: METADATA_HEADERS, timeout: 2000 }
        )
        return response.data
    } catch {
        return null
    }
}

/**
 * Get GCP instance name from metadata
 */
async function getGCPInstanceName(): Promise<string | null> {
    try {
        const response = await axios.get(
            `${GCP_METADATA_URL}/instance/name`,
            { headers: METADATA_HEADERS, timeout: 2000 }
        )
        return response.data
    } catch {
        return null
    }
}

/**
 * Start the heartbeat service
 * Periodically reports VM capacity and usage to BRaas
 * 
 * Config sources (in order of priority):
 * 1. Function arguments (config)
 * 2. Environment variables
 * 3. GCP instance metadata (auto-injected at VM creation)
 */
export async function startHeartbeat(logger: Logger, config?: Partial<HeartbeatConfig>): Promise<void> {
    const intervalMs = config?.intervalMs || 60000 // 1 minute

    // Try to get config from: args > env > GCP metadata
    let braasUrl = config?.braasUrl || process.env.BRAAS_URL
    let heartbeatKey = config?.heartbeatKey || process.env.BRAAS_HEARTBEAT_KEY
    let instanceName = config?.instanceName || process.env.VM_INSTANCE_NAME

    // If not in env, try GCP metadata
    if (!braasUrl || !heartbeatKey || !instanceName) {
        logger.info({ message: "Checking GCP metadata for heartbeat config" }, "HEARTBEAT_CHECKING_METADATA")
        
        braasUrl = braasUrl || await getGCPMetadata('BRAAS_URL')
        heartbeatKey = heartbeatKey || await getGCPMetadata('BRAAS_HEARTBEAT_KEY')
        instanceName = instanceName || await getGCPInstanceName()
    }

    // Skip if still not configured (optional feature)
    if (!braasUrl || !heartbeatKey || !instanceName) {
        logger.info({
            message: "Heartbeat disabled - no config found in env or GCP metadata",
            hasUrl: !!braasUrl,
            hasKey: !!heartbeatKey,
            hasInstanceName: !!instanceName
        }, "HEARTBEAT_DISABLED")
        return
    }

    const heartbeatUrl = `${braasUrl}/functions/v1/vm-heartbeat`

    logger.info({
        message: "Starting heartbeat service",
        url: heartbeatUrl,
        instanceName,
        intervalMs
    }, "HEARTBEAT_STARTING")

    // Send initial heartbeat
    sendHeartbeat(logger, heartbeatUrl, heartbeatKey, instanceName)

    // Start interval
    heartbeatInterval = setInterval(() => {
        sendHeartbeat(logger, heartbeatUrl, heartbeatKey, instanceName)
    }, intervalMs)
}

/**
 * Stop the heartbeat service
 */
export function stopHeartbeat(): void {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
        heartbeatInterval = null
    }
}

/**
 * Send a single heartbeat to BRaas
 */
async function sendHeartbeat(
    logger: Logger,
    url: string,
    apiKey: string,
    instanceName: string
): Promise<void> {
    try {
        // Get current status from browser-cmgr
        const status = await detailedStatus()
        
        const payload = {
            instance_name: instanceName,
            capacity: parseInt(status.capacity) || 0,
            used: status.used || 0,
            status: "running"
        }

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            timeout: 10000 // 10 second timeout
        })

        if (response.status === 200) {
            logger.debug({
                message: "Heartbeat sent successfully",
                capacity: payload.capacity,
                used: payload.used
            }, "HEARTBEAT_SUCCESS")
        }
    } catch (error) {
        // Don't crash on heartbeat failure - just log and continue
        const message = error instanceof Error ? error.message : 'Unknown error'
        const status = axios.isAxiosError(error) ? error.response?.status : undefined
        
        logger.warn({
            message: "Heartbeat failed",
            error: message,
            status
        }, "HEARTBEAT_FAILED")
    }
}
