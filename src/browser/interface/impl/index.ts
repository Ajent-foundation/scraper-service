// actions
import select from "./actions/select"
import keyPress from "./actions/keyPress"

// Scroll
import scrollNext from "./scroll/scrollNext"
import scrollTo from "./scroll/scrollTo"
import scrollBottom from "./scroll/scrollBottom"
import scrollTop from "./scroll/scrollTop"

import scrollAtPosition from "./scroll/scrollAtPosition"

// Screenshots
import fullScreenshot from "./screenshots/fullScreenshot"
import screenShot from "./screenshots/screenShot"
import systemScreenshot from "./screenshots/systemScreenshot"

// Actions
import typeInput from "./actions/typeInput"
import checkBox from "./actions/checkBox"
import smartClick from "./actions/smartClick"
import click from "./actions/click"
import customAction from "./actions/customAction"
import injectJavascript from "./actions/injectJavascript"
import hover from "./actions/hover"
import delay from "./actions/delay"

// Getters
import getElms from "./getters/getElms"
import getSelectOptions from "./getters/getSelectOptions"
import getRepeatedElmsByXpathCommand from "./getters/getRepeatedElmsByXpathCommand"
import getRepeatedElmsCommand from "./getters/getRepeatedElmsCommand"

// SYs
import closeDialog from "./sys/closeDialog"
import isDialogOpen from "./sys/isDialogOpen"
import selectFileFromDialog from "./sys/selectFileFromDialog"

export default {
    // actions
    select,
    typeInput,
    checkBox,
    smartClick,
    click,
    customAction,
    injectJavascript,
    hover,
    delay,
    keyPress,

    // Getters
    getElms,
    getSelectOptions,
    getRepeatedElmsByXpathCommand,
    getRepeatedElmsCommand,

    // Sys
    closeDialog,
    isDialogOpen,
    selectFileFromDialog,

    // Scroll
    scrollNext,
    scrollTo,
    scrollBottom,
    scrollTop,
    scrollAtPosition,
    // Screenshots
    fullScreenshot,
    screenShot,
    systemScreenshot
}