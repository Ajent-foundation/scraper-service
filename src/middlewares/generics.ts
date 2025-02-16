import { Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import UTILITY from '../helpers/utility'
import { ZodError } from 'zod'

export function NOT_FOUND( req:Request, res:Response, next:NextFunction ){
    if(res.headersSent) {
        return next()
    }

    UTILITY.EXPRESS.respond(res, 404, {
        code: "NOT_FOUND",
        message: "Not Found"
    })
}

export const ERR_HANDLER: ErrorRequestHandler = (err:any, req:Request, res:Response, next:NextFunction) => {
    if(res.headersSent) {
        return
    }

    if(err instanceof ZodError) {
        UTILITY.EXPRESS.respond(res, 400, {
            code: "BAD_REQUEST",
            message: "Invalid input. Please check the data you have provided and try again. ",
            errors: err.errors
        })
    } else {
        res.locals.httpInfo.status_code = 500
        res.log.error({
            message: err.message, 
            stack: err.stack,
            request_id: res.locals.httpInfo.request_id,
            startTime: res.locals.generalInfo.startTime,
            httpInfo: res.locals.httpInfo
        }, "middlewares:generics:ERR_HANDLER")
        UTILITY.EXPRESS.respond(res, 500, {
            code: "UNKNOWN_ERROR",
            message: "Unknown Error"
        })
    }
}