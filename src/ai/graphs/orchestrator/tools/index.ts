export { goToPage } from "./goToPage";
export { click } from "./click";
export { getElms } from "./getElms";
export { screenshot } from "./screenshot";
export { type } from "./type";
export { scroll } from "./scroll";
export { move } from "./move";
export { wait } from "./wait";
export { goBack } from "./goBack";
export { pressEnter, pressEscape } from "./pressKey";
export { switchTab, closeTab } from "./tabs";
export { captureDataScreenshot } from "./captureDataScreenshot";

import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { goToPage } from "./goToPage";
import { click } from "./click";
import { type } from "./type";
import { scroll } from "./scroll";
import { move } from "./move";
import { wait } from "./wait";
import { goBack } from "./goBack";
import { pressEnter, pressEscape } from "./pressKey";
import { switchTab, closeTab } from "./tabs";
import { captureDataScreenshot } from "./captureDataScreenshot";

/** Browser tools exposed to the AI. Screenshot, getElms, and tab list are auto-run after every action and passed as last message in invoke only. */
export const browserTools: TZodBaseToolDefinition<TBrowserContext, any, any>[] = [
    goToPage,
    click,
    type,
    scroll,
    move,
    wait,
    goBack,
    pressEnter,
    pressEscape,
    switchTab,
    closeTab,
    captureDataScreenshot,
];

