import { Logger } from "pino"
import { selectFileFromDialog } from "../../../../apis/node"

export default async function execute(logger: Logger, headers: Record<string, string>, url: string, fileName: string) {
    try{
        await selectFileFromDialog(logger, headers, url, fileName)
        return {}
    } catch (error: unknown) {
        return {
            code: 'FAILED_TO_CLOSE_DIALOG',
			message: 'Failed to close dialog',
        }
    }
}