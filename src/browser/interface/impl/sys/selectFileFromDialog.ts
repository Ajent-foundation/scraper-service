import { selectFileFromDialog } from "../../../../apis/node"
import { Logger } from "pino"

export default async function execute(logger: Logger, url: string, fileName: string) {
    try{
        await selectFileFromDialog(logger, url, fileName)
        return {}
    } catch (error: unknown) {
        return {
            code: 'FAILED_TO_CLOSE_DIALOG',
			message: 'Failed to close dialog',
        }
    }
}