import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache'
import {Browser, Page} from 'puppeteer'
import { getCurrentPage } from '../../browser/pages';
import { Logger } from 'pino';
import { BrowserSession } from '../../apis/browsers-cmgr'
import { BaseRequest } from '../../helpers/Base'
import UTILITY from '../../helpers/utility'
import { connectToBrowser } from '../../browser';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
import { z } from 'zod';

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>();

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

export async function extractMarkdown(
    req:Request<RequestQuery, {}, RequestBody, RequestQuery>, 
    res:Response, 
    next:NextFunction
){
    // InitVars
    const cache   : NodeCache = res.locals.cache
    const session : BrowserSession = cache.get(res.locals.sessionID)

    // Validate Zod
	try {
		RequestBodySchema.parse(req.body)
		RequestQuerySchema.parse(req.query)
		RequestParamsSchema.parse(req.params)
	} catch (err) {
		next(err);
		return;
	}

    // Logic
    try{
        const puppeteerBrowser: Browser = await connectToBrowser(
			res.log,
			res.locals.importantHeaders ? res.locals.importantHeaders : {},
			session.url,
			res.locals.sessionID
		);
		const pageObject: { page: Page; index: number } = await getCurrentPage(res.log, res.locals.importantHeaders ? res.locals.importantHeaders : {}, puppeteerBrowser, session.config);
        const page = pageObject.page

        const html = await page.content();
        let markdown = ""
        try {
            // Create a DOM from the page content
            const dom = new JSDOM(html, { url: session.url }); // Provide the URL to resolve relative links
            const document = dom.window.document;

            // Use Readability to parse the article
            const reader = new Readability(document, {
                charThreshold: 0,
                keepClasses: true,
                nbTopCandidates: 500,
            });
            const article = reader.parse();

            if (article && article.content) {
                // Use Turndown to convert HTML to Markdown
                const turndownService = new TurndownService();
                markdown = turndownService.turndown(article.content);
            } else {
                res.log.error({
                    ...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
                    message: "Article or article content not found",
                    article,
                    stack: undefined,
                }, "MARKDOWN_ERROR")

                // TODO - parse markdown in a different way
                throw new Error('Failed to parse the article content');
            }
        } catch(error){
            res.log.error({
                ...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
                message: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined,
            }, "ENDPOINT_ERROR")
        }

        // puppeteerBrowser.disconnect()
        UTILITY.EXPRESS.respond(res, 200, {
            page: markdown || "EMPTY"
        })
    } catch(error){
        // log Error
        res.locals.httpInfo.status_code = 500
        res.log.error({
            ...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
        }, "ENDPOINT_ERROR")

        UTILITY.EXPRESS.respond(res, 500, {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal Server Error"
        })
    }

    // Move to next function
    next()
}

export default extractMarkdown