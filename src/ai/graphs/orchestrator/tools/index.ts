export { goToPage } from "./goToPage";
export { click } from "./click";
export { getElms } from "./getElms";
export { screenshot } from "./screenshot";
export { type } from "./type";
export { scroll } from "./scroll";
export { move } from "./move";
export { wait } from "./wait";
export { goBack } from "./goBack";

import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { goToPage } from "./goToPage";
import { click } from "./click";
import { getElms } from "./getElms";
import { screenshot } from "./screenshot";
import { type } from "./type";
import { scroll } from "./scroll";
import { move } from "./move";
import { wait } from "./wait";
import { goBack } from "./goBack";

/** Browser tools exposed to the AI. Screenshot and getElms are auto-run after every action and passed as last message in invoke only. */
export const browserTools: TZodBaseToolDefinition<TBrowserContext, any, any>[] = [
    goToPage,
    click,
    type,
    scroll,
    move,
    wait,
    goBack,
];

