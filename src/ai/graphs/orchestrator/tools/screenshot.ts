import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { getBrowserURL } from "../../../../apis/browsers-cmgr";
import actionImpl from "../../../../browser/interface/impl/index";
import { z } from "zod";

export const screenshot: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "screenshot",
    description: "Take a system-level screenshot (VNC screenshot) of the browser window. This captures the entire browser window including browser chrome.",
    zodParameters: z.object({}),
    implementation: async (global, args) => {
        // Use existing implementation (following executeCommands pattern)
        // Note: executeCommands builds URL from session.url, but we use getBrowserURL helper
        const browserURL = getBrowserURL(global.session);
        const firstColon = browserURL.indexOf(':');
        const baseUrl = browserURL.substring(0, browserURL.indexOf(':', firstColon + 1));
        const appPort = global.session.appPort;
        
        const result = await actionImpl.systemScreenshotV2({
            url: `${baseUrl}:${appPort}`,
            resize: 50,
            quality: 100,
        });

        return {
            base64Images: [`data:image/png;base64,${result.img}`],
            text: JSON.stringify({
                message: "Screenshot taken",
            }),
        };
    },
};