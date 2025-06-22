import { Logger } from 'pino'
import { isBrowserActive } from "../../../../apis/node"

export default async function execute(logger: Logger, headers: Record<string, string>, url: string) {
    try{
        return await isBrowserActive(logger, headers, url)
    } catch (error: unknown) {
        return {
            code: 'FAILED_TO_CLOSE_DIALOG',
			message: 'Failed to close dialog',
        }
    }
}