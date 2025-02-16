import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache'
import {Browser, Page} from 'puppeteer'
import { getCurrentPage } from '../../browser/pages';
import { BrowserSession } from '../../apis/browsers-cmgr'
import { BaseRequest } from '../../helpers/Base'
import UTILITY from '../../helpers/utility'
import { connectToBrowser } from '../../browser';
import { extractJSON } from '../../helpers/extract/links/newDomParser';
import { parse } from 'path';
import { z } from 'zod';

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>();

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

// TODO deprecated  => remove
export async function parseToJSON(req:Request<RequestQuery, {}, RequestBody, RequestQuery>, res:Response, next:NextFunction){
    // InitVars
    let cache   : NodeCache = res.locals.cache
    let session : BrowserSession = cache.get(res.locals.sessionID)

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
        const puppeteerBrowser: Browser = await connectToBrowser(session.url);
		const pageObject: { page: Page; index: number } = await getCurrentPage(puppeteerBrowser, session.config);
        const page = pageObject.page
        
        // Run Extract 
        //TODO: add screenshots function 
        const parsedJSON = await extractJSON(page)

        puppeteerBrowser.disconnect()
        UTILITY.EXPRESS.respond(res, 200, {
            response: parsedJSON
        })
    } catch(err){
        // log Error
        res.log.error({
            message: err.message, 
            stack: err.stack,
            startTime: res.locals.generalInfo.startTime,
        }, "page:parseToJSON:64");

        UTILITY.EXPRESS.respond(res, 500, {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal Server Error"
        })
    }

    // Move to next function
    next()
}

export default parseToJSON;