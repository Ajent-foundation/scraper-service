import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession } from '../../apis/browsers-cmgr';
import { BaseRequest } from '../../helpers/Base';
import UTILITY from '../../helpers/utility';
import { Browser } from 'puppeteer';
import { connectToBrowser, VIEW_PORT } from '../../browser';
import { configureGhostCursor } from './ghostCursor';
import {
	getCurrentPage,
	getPageAtIndex,
	getPageCount,
} from '../../browser/pages';
import {
	awaitPageTillLoaded,
	waitTillNotBlankPage,
} from '../../browser/pages/awaitPage';
import { GhostCursor } from 'ghost-cursor';
import { Action, Command } from '../../handlers/page/executeCommands';
import { z } from 'zod';

import actionImpl from "./impl"

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>().and(
	z.object({
		commands: z.array(z.custom<Command>()),
	})
);

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

export async function executeBrowserCommands(
	req: Request<RequestQuery, {}, RequestBody, RequestQuery>,
	res: Response,
	next: NextFunction,
) {
	// InitVars
	// InitVars
	const cache: NodeCache = res.locals.cache;
	const session: BrowserSession = cache.get(res.locals.sessionID);
    let cursor: GhostCursor | null = null;

    var startTime = new Date().getTime();

    const puppeteerBrowser: Browser = await connectToBrowser(
        res.log,
        res.locals.importantHeaders ? res.locals.importantHeaders : {},
        session.url,
        res.locals.sessionID
    );
    let { page, index, pageCount } = await getCurrentPage(
        res.log,
        res.locals.importantHeaders ? res.locals.importantHeaders : {},
        puppeteerBrowser,
        session.config,
    );
    if(!page){
        UTILITY.EXPRESS.respond(res, 400, {
            code: 'Invalid_Page',
            message: 'Page is blank, please navigate to a valid page',
        });
        next();
        return;
    }

    if (session.config && session.config.ghostCursor) {
        cursor = await configureGhostCursor(page, session.config.cursorConfig);
    }

    const responses = [];
    const devicePixelRatio = await page.evaluate(
        () => window.devicePixelRatio,
    );

    // Log session
	res.log.info({
		commands: req.body.commands,
		sessionID: res.locals.sessionID,
		session: session,
		page: page.url(),
		devicePixelRatio: devicePixelRatio,
        index, 
        pageCount,
        startTime
	}, "EXECUTE_COMMANDS")

    // Check if page is blank
    if (page.url() == 'about:blank') {
        UTILITY.EXPRESS.respond(res, 400, {
            code: 'Invalid_Page',
            message: 'Page is blank, please navigate to a valid page',
        });
        next();
        return;
    }

    var fullPageIncludedInCommands = false;
    for (let command of req.body.commands) {
        if (command.action == Action.GetElms) {
            if (command.fullPage == true) {
                fullPageIncludedInCommands = true;
                break;
            }
        }
    }

    // let originalBodyOverflow = await page.evaluate(() => document.body.style.overflow);
    // await page.evaluate(() => {
    //     document.body.style.overflow = 'hidden';
    // });

    if (fullPageIncludedInCommands) {
        let totalHeight = await page.evaluate(
            () => document.documentElement.scrollHeight,
        );
        const currentViewportWidth = await page.evaluate(() => {
            return window.innerWidth;
        });

        if (totalHeight > 16384) {
            totalHeight = 16384;
        }

        await page.setViewport({
            width: currentViewportWidth,
            height: totalHeight,
        });
        //delay 500 ms
        await new Promise((resolve) => setTimeout(resolve, 500));

        // scroll to the top
        await page.evaluate(() => {
            window.scrollTo(0, 0);
        });

        // // prevent scrollbar from affecting the page size
        // await page.evaluate((originalBodyOverflow) => {
        //     document.body.style.overflow = originalBodyOverflow;
        // }, originalBodyOverflow);
    }

    for (let command of req.body.commands) {
        try {
            // Getters
            if (command.action == Action.GetRepeatedElmsCommand) {
                responses.push(
                    await actionImpl.getRepeatedElmsCommand(
                        page,
                        {
                            ...command,
                        }
                    )
                );
            } else if (command.action == Action.GetRepeatedElmsByXpathCommand) {
                responses.push(
                    await actionImpl.getRepeatedElmsByXpathCommand(
                        page,
                        {
                            ...command,
                        }
                    )
                );
            } else if (command.action == Action.GetSelectOptions) {
                responses.push(
                    await actionImpl.getSelectOptions(
                        page,
                        {
                            ...command,
                        }
                    )
                );
            } else if (command.action == Action.GetElms) {
                responses.push(
                    await actionImpl.getElms(
                        res.log,
                        res.locals.importantHeaders ? res.locals.importantHeaders : {},
                        page,
                        puppeteerBrowser,
                        cursor,
                        {
                            config: session.config,
                            viewPort: res.locals.viewPort,
                            ...command,
                        }
                    )
                );
            } 
            // Actions
            else if (command.action == Action.Delay) {
                responses.push(
                    await actionImpl.delay(
                        {
                            ...command,
                        }
                    )
                );
            } else if (command.action == Action.Hover) {
                responses.push(
                    await actionImpl.hover(
                        page,
                        cursor,
                        {
                            ...command,
                        }
                    )
                )
            } else if (command.action == Action.InjectJavascript) {
                responses.push(
                    await actionImpl.injectJavascript(
                        page,
                        {
                            ...command,
                        }
                    )
                )
            } else if (command.action == Action.CustomAction) {
                responses.push(
                    await actionImpl.customAction(
                        {
                            ...command,
                        }
                    )
                )
            } else if (command.action == Action.Click) {
                responses.push(
                    await actionImpl.click(
                        page,
                        cursor,
                        {
                            ...command,
                        }
                    )
                );
            } else if (command.action == Action.SmartClick) {
                responses.push(
                    await actionImpl.smartClick(
                        page,
                        cursor,
                        {
                            ...command,
                        }
                    )
                );
            } else if (command.action == Action.CheckBox) {
                responses.push(
                    await actionImpl.checkBox(
                        page,
                        cursor,
                        {
                            ...command,
                        }
                    )
                );
            } else if (command.action == Action.KeyPress) {
                responses.push(
                    await actionImpl.keyPress(
                        page,
                        {
                            ...command,
                        }
                    )
                );
            } else if (command.action == Action.TypeInput) {
                responses.push(
                    await actionImpl.typeInput(
                        page,
                        cursor,
                        {
                            ...command,
                        }
                    )
                );
            } else if (command.action == Action.Select) {
                responses.push(
                    await actionImpl.select(
                        page,
                        cursor,
                        {
                            ...command,
                        }
                    )
                );
            } 

            
            // Screenshots
            else if (command.action == Action.FullScreenshot) {
                responses.push(
                    await actionImpl.fullScreenshot(
                        res.log,
                        res.locals.importantHeaders ? res.locals.importantHeaders : {},
                        page,
                        {
                            config: session.config,
                            ...command
                        }
                    )
                )
            } else if (command.action == Action.ScreenShot) {
                responses.push(
                    await actionImpl.screenShot(
                        page,
                        {
                            ...command
                        }
                    )
                )
            } else if (command.action == Action.SystemScreenshot) {
                const firstColon = session.url.indexOf(':');
                const baseUrl = session.url.substring(0, session.url.indexOf(':', firstColon + 1));
                responses.push(
                    await actionImpl.systemScreenshot(
                        {
                            url: `${baseUrl}:${session.appPort}`,
                            ...command
                        }
                    )
                )
            } else if (command.action == Action.SystemScreenshotV2) {
                const firstColon = session.url.indexOf(':');
                const baseUrl = session.url.substring(0, session.url.indexOf(':', firstColon + 1));
                responses.push(
                    await actionImpl.systemScreenshotV2(
                        {
                            url: `${baseUrl}:${session.appPort}`,
                            ...command
                        }
                    )
                )
            } else if (command.action == Action.SetGeoLocation) {
                responses.push(
                    await actionImpl.setGeoLocation(
                        page,
                        { ...command }
                    )
                )
            }

            // Sys
            else if (command.action == Action.CloseDialog) {
                responses.push(
                    await actionImpl.closeDialog(res.log, res.locals.importantHeaders ? res.locals.importantHeaders : {}, session.browserID)
                );
            }
            else if (command.action == Action.IsDialogOpen) {
                responses.push(
                    await actionImpl.isDialogOpen(res.log, res.locals.importantHeaders ? res.locals.importantHeaders : {}, session.browserID)
                );
            }
            else if (command.action == Action.SelectFileFromDialog) {
                responses.push(
                    await actionImpl.selectFileFromDialog(res.log, res.locals.importantHeaders ? res.locals.importantHeaders : {}, session.browserID, command.fileName)
                );
            }
            
            // Scrolling
            else if (command.action == Action.ScrollTop) {
                responses.push(
                    await actionImpl.scrollTop(page, res.log)
                );
            } else if (command.action == Action.ScrollBottom) {
                responses.push(
                    await actionImpl.scrollBottom(page, res.log)
                );
            } else if (command.action == Action.ScrollTo) {
                responses.push(
                    await actionImpl.scrollTo(
                        page, 
                        {
                            ...command
                        },
                        res.log
                    )
                );
            } else if (command.action == Action.ScrollNext) {
                responses.push(
                    await actionImpl.scrollNext(page, res.log)
                );      
            } else if (command.action == Action.ScrollAtPosition) {
                responses.push(
                    await actionImpl.scrollAtPosition(
                        page, 
                        cursor,
                        {
                            ...command
                        },
                        res.log
                    )
                );
            } 
            
            // Action Not Found
            else {
                responses.push({
                    code: 'Invalid_Command',
                    message: 'Invalid Command',
                });
            }
        } catch (error) {
            console.error(`Error executing command ${command.action}:`, error);
            responses.push({
                code: 'Command_Execution_Error',
                message: `Error executing ${command.action}: ${error.message}`,
                error: error.message
            });
            
            // Try to recover the page if it was destroyed
            try {
                const url = await page.url();
                console.log('Current page URL:', url);
            } catch (pageError) {
                console.log('Page context was destroyed, getting new page');
                try {
                    const newPage = await getCurrentPage(
                        res.log,
                        res.locals.importantHeaders ? res.locals.importantHeaders : {},
                        puppeteerBrowser,
                        session.config,
                    );
                    page = newPage.page;
                    index = newPage.index;
                    if (session.config && session.config.ghostCursor) {
                        cursor = await configureGhostCursor(page, session.config.cursorConfig);
                    }
                } catch (recoveryError) {
                    console.error('Failed to recover page:', recoveryError.message);
                }
            }
        }

        // Check if page changed to a new tab
        if (
            command.action == Action.Click ||
            command.action == Action.SmartClick ||
            command.action == Action.InjectJavascript ||
            command.action == Action.CustomAction
            // ||
            // command.action == Action.ScrollBottom ||
            // command.action == Action.ScrollTop ||
            // command.action == Action.ScrollNext ||
            // command.action == Action.ScrollTo ||
            // command.action == Action.FullScreenshot
        ) {
            console.log(
                'TIME 3a :',
                (new Date().getTime() - startTime) / 1000,
            );

            var viewportWidth = 1280; // Example: your current viewport width

            var clipWidth = 1000;
            var clipHeight = 600;

            var clipSettings = {
                x: (viewportWidth - clipWidth) / 2,
                y: 0,
                width: clipWidth,
                height: clipHeight,
            };

            var settings = {
                encoding: 'binary',
                fullPage: false,
                // clip: clipSettings, // This applies the clip area defined above
            };

            // check if command has x and y
            if (
                command.action == Action.Click ||
                command.action == Action.SmartClick
            ) {
                var clipWidth = 500;
                var clipHeight = 500;

                // we want to capture the area around the click, 500px x 500px

                var clipSettings = {
                    x: command.x - clipWidth / 2,
                    y: command.y - clipHeight / 2,
                    width: clipWidth,
                    height: clipHeight,
                };

                settings = {
                    encoding: 'binary',
                    fullPage: false,
                    // clip: clipSettings, // This applies the clip area defined above
                };
            }

            console.log(
                'TIME 3b :',
                (new Date().getTime() - startTime) / 1000,
            );

            // Sleep 
            await new Promise((resolve) => setTimeout(resolve, 2000));

            try {
                //Check if page changed to a new tab
                const newPageCount = await getPageCount(puppeteerBrowser);

                if (newPageCount > pageCount) {
                    // Update page count
                    const currPageIndex = newPageCount - 1;
                    const newPage = (
                        await getPageAtIndex(
                            res.log,
                            res.locals.importantHeaders ? res.locals.importantHeaders : {},
                            puppeteerBrowser,
                            session.config,
                            currPageIndex
                        )
                    ).page;
                    
                    page = newPage;
                    index = currPageIndex;
                    if (session.config && session.config.ghostCursor) {
                        cursor = await configureGhostCursor(page, session.config.cursorConfig);
                    }

                    await waitTillNotBlankPage(page);
                    await awaitPageTillLoaded(
                        res.log,
                        res.locals.importantHeaders ? res.locals.importantHeaders : {},
                        puppeteerBrowser,
                        index,
                        200,
                        10000,
                        settings,
                    );
                    await page.bringToFront();
                } else {
                    await awaitPageTillLoaded(
                        res.log,
                        res.locals.importantHeaders ? res.locals.importantHeaders : {},
                        puppeteerBrowser,
                        index,
                        150,
                        10000,
                        settings,
                    );
                }
            } catch (error) {
                console.error('Error during post-processing:', error.message);
                // Try to recover the page if needed
                try {
                    const newPage = await getCurrentPage(
                        res.log,
                        res.locals.importantHeaders ? res.locals.importantHeaders : {},
                        puppeteerBrowser,
                        session.config,
                    );
                    page = newPage.page;
                    index = newPage.index;
                    if (session.config && session.config.ghostCursor) {
                        cursor = await configureGhostCursor(page, session.config.cursorConfig);
                    }
                } catch (recoveryError) {
                    console.error('Failed to recover page during post-processing:', recoveryError.message);
                }
            }
        }
    }

    console.log('TIME 4 :', (new Date().getTime() - startTime) / 1000);

    console.log('TIME 7 :', (new Date().getTime() - startTime) / 1000);

    /* let pageHeight:number = await page.evaluate(() => {
        return Number(document.body.scrollHeight)
    }) */

    let pageHeight = 2400; // Default to 0 or a sensible default for your context
    let scroller = {
        scrollX: 0,
        scrollY: 0,
        scrollHeight: pageHeight,
    };




    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            pageHeight = await page.evaluate(() => {
                return Number(document.body.scrollHeight);
            });

            // Use page.evaluate to get the scroll position
            scroller = await page.evaluate(() => {
                return {
                    scrollX: Number(window.scrollX),
                    scrollY: Number(window.scrollY),
                    scrollHeight: Number(document.body.scrollHeight),
                    scrollWidth: Number(document.body.scrollWidth),
                };
            });
            break;
        } catch (error) {
            console.error('Failed to get page height:', error);
            // Log additional diagnostic information
            console.log('Current URL:', page.url());
            // Consider adding more diagnostics here, e.g., current state of the page,
            // screenshot, etc., to help with debugging.
            // For example, take a screenshot of the current state:
            // await page.screenshot({ path: 'error-screenshot.png' });

            // Delay 
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    console.log('Page Height2:', pageHeight);

    console.log('position: fsalj2');

    // puppeteerBrowser.disconnect();
    UTILITY.EXPRESS.respond(res, 200, {
        sessionID: session.sessionID,
        page: {
            url: page.url(),
            devicePixelRatio: devicePixelRatio,
            scroller: scroller,
            pageDimensions: {
                width: 
                    session.config && session.config.viewport
                        ? session.config.viewport.width
                        : VIEW_PORT,
                height: pageHeight,
            },
        },
        responses,
    });

    console.log('TIME 8 :', (new Date().getTime() - startTime) / 1000);
}