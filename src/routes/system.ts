import { Router } from 'express';
import mouse from '../handlers/system/mouse';
import keyboard from '../handlers/system/keyboard';
import clipboardGet from '../handlers/system/clipboardGet';
import clipboardSet from '../handlers/system/clipboardSet';
import screenshot from '../handlers/system/screenshot';
import scrollHandler from '../handlers/system/scroll';
import dragHandler from '../handlers/system/drag';
import screenSize from '../handlers/system/screenSize';
import shell from '../handlers/system/shell';
import windows from '../handlers/system/windows';
import isBrowserActive from '../handlers/system/isBrowserActive';
import closeDialog from '../handlers/system/closeDialog';
import selectFileFromDialog from '../handlers/system/selectFileFromDialog';

const SYSTEM_ROUTES = Router();

// Mouse endpoints
SYSTEM_ROUTES.post('/:sessionID/mouse', mouse);
SYSTEM_ROUTES.get('/:sessionID/mouse', mouse); // For location/state queries

// Keyboard endpoints
SYSTEM_ROUTES.post('/:sessionID/keyboard', keyboard);
SYSTEM_ROUTES.get('/:sessionID/keyboard', keyboard); // For state queries

// Clipboard endpoints
SYSTEM_ROUTES.get('/:sessionID/clipboard', clipboardGet);
SYSTEM_ROUTES.post('/:sessionID/clipboard', clipboardSet);

// Screenshot endpoint
SYSTEM_ROUTES.get('/:sessionID/screenshot', screenshot);

// Scroll endpoint
SYSTEM_ROUTES.post('/:sessionID/scroll', scrollHandler);

// Drag endpoint
SYSTEM_ROUTES.post('/:sessionID/drag', dragHandler);

// Screen size endpoint
SYSTEM_ROUTES.get('/:sessionID/screen/size', screenSize);

// Shell command endpoint
SYSTEM_ROUTES.post('/:sessionID/shell', shell);

// Windows endpoints
SYSTEM_ROUTES.get('/:sessionID/windows', windows);
SYSTEM_ROUTES.post('/:sessionID/window/control', windows);

// Browser status and dialog endpoints
SYSTEM_ROUTES.get('/:sessionID/isBrowserActive', isBrowserActive);
SYSTEM_ROUTES.post('/:sessionID/closeDialog', closeDialog);
SYSTEM_ROUTES.post('/:sessionID/selectFileFromDialog', selectFileFromDialog);

export default SYSTEM_ROUTES;

