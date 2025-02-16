import { isBrowserActive } from "../../../../apis/node"
import { Logger } from "pino"

export default async function execute(logger: Logger, url: string) {
    try{
        return await isBrowserActive(logger, url)
    } catch (error: unknown) {
        return {
            code: 'FAILED_TO_CLOSE_DIALOG',
			message: 'Failed to close dialog',
        }
    }
}