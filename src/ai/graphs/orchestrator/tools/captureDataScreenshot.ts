import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { getBrowserHostname } from "../../../../apis/browsers-cmgr";
import actionImpl from "../../../../browser/interface/impl/index";
import { z } from "zod";

/**
 * Capture a screenshot with a label to remember/record the current state.
 * This is different from the automatic screenshot - this is an explicit action
 * to record what the AI sees at a specific point, with a label for reference.
 */
export const captureDataScreenshot: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "captureDataScreenshot",
    description: `Capture and record the current screen state with a label. Use this to:
- Record data you've collected (e.g., account numbers, balances)
- Mark a checkpoint before taking an action
- Remember what the page looked like at a specific point
- Avoid repeating actions by recording what you've already done

WARNING: Use sparingly - each capture consumes context. Only use when you need to explicitly record/remember something important.`,
    zodParameters: z.object({
        label: z.string().describe("A descriptive label for this screenshot (e.g., 'Account 1 details', 'Before clicking submit', 'Collected balance info')"),
        reason: z.string().describe("Why you are capturing this screenshot (e.g., 'Recording account details before moving to next account')"),
    }),
    implementation: async (global, args) => {
        const hostname = getBrowserHostname(global.session);
        const appPort = global.session.appPort;
        const url = `http://${hostname}:${appPort}`;

        const result = await actionImpl.systemScreenshotV2({
            url,
            resize: 50,
            quality: 100,
        });

        return {
            base64Images: [`data:image/png;base64,${result.img}`],
            text: `📸 CAPTURED: "${args.label}"\nReason: ${args.reason}\n\nThis screenshot has been recorded. You can reference this label to remember what you saw here.`,
        };
    },
};
