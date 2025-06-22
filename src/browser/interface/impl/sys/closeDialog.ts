import { Logger } from 'pino'
import { closeDialog } from "../../../../apis/node"

export default async function execute(logger: Logger, headers: Record<string, string>, url: string) {
    try {
        await closeDialog(logger, headers, url)
        return {}
    } catch (error: unknown) {
        return {
            code: 'FAILED_TO_CLOSE_DIALOG',
			message: 'Failed to close dialog',
        }
    }
}