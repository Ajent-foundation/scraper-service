import express, { Application } from 'express'
import { Request, Response, NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import NodeCache from 'node-cache'
import { freeUpSession } from './apis/browsers-cmgr'
import { NOT_FOUND, ERR_HANDLER} from './middlewares/generics'
import { createServer, Server } from 'http'
import httpProxy from 'http-proxy'
import { detailedStatus } from './apis/browser-cmgr/detailedStatus'
import { pino } from 'pino'
import pinoHttp from 'pino-http'

// Routes
import DefaultRoutesHandler from "./routes/default"
import PageRoutesHandler from "./routes/page"
import SessionRoutesHandler from "./routes/session"
import { IDetailedStatusResponse } from './apis/browser-cmgr/detailedStatus'

let httpServer: Server = undefined
let wsProxy = httpProxy.createProxyServer({})
let vncProxy = httpProxy.createProxyServer({})
let cache: NodeCache = undefined

export type TConfig = {
    EXPRESS_PORT: string
    OPENAI_API_KEY?: string
    ANTHROPIC_API_KEY?: string
    BROWSER_POC_SERVICE?: string
}

export async function main(deployment: string, config: TConfig, logPath?: string) {
    process.env.SERVICE_NAME = "scraper-service-ts"
    process.env.DEPLOYMENT = deployment
    process.env.BROWSER_POC_SERVICE = config.BROWSER_POC_SERVICE || "http://127.0.0.1:8200"
    process.env.BAAS_ENABLED = "false"
    if(config.OPENAI_API_KEY) process.env.OPENAI_API_KEY
    if(config.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY

    // III -  Init Logger
    const Logger = pino({
        level: 'info',
    }, pino.multistream([
        { stream: process.stdout },
        ...(logPath ? [
            { stream: pino.destination({
                dest: logPath,
                sync: false,  // Set to true if you need synchronous writes
                mkdir: true   // Create directory if it doesn't exist
            })}
        ] : [])
    ]))

    // Add error handlers for both proxies
    wsProxy.on('error', (err, req, res) => {
        Logger.error({
            message: "WS Proxy Error",
            error: err,
            request: req
        }, "WS_PROXY_ERROR")
    })

    vncProxy.on('error', (err, req, res) => {
        Logger.error({
            message: "VNC Proxy Error",
            error: err,
            request: req
        }, "VNC_PROXY_ERROR")
    })

    const EXPRESS_PORT: number = parseInt(config.EXPRESS_PORT)
    const CACHE_TIMEOUT = 3600
    const TIMEOUT = 60000
    const VIEW_PORT = {
        width: 1280,
        height: 2400
    }

    //InitCache
    cache = new NodeCache({
        stdTTL:0, 
        checkperiod:TIMEOUT, 
        useClones:true
    })
    
    //InitExpress
    const EXPRESS_APP: Application = express()
    httpServer = createServer(EXPRESS_APP)

    // Express-Core
    EXPRESS_APP.use(pinoHttp({
        logger: Logger,
        autoLogging: false
    }))
    EXPRESS_APP.use((req:Request, res:Response, next:NextFunction) => {
        res.locals.cache  = cache
        res.locals.timeout = TIMEOUT
        res.locals.cacheTimeout = CACHE_TIMEOUT
        res.locals.viewPort = VIEW_PORT

        next()
    })

    // Express-Plugins 
    EXPRESS_APP.use(express.urlencoded({ extended: true }))
    EXPRESS_APP.use(express.json())
    EXPRESS_APP.use(cookieParser())

    // Express-Middlewares

    // Express-Routes
    EXPRESS_APP.use("/", 
        DefaultRoutesHandler
    )

    EXPRESS_APP.use("/page", 
        PageRoutesHandler
    )
    
    EXPRESS_APP.use("/session", 
        SessionRoutesHandler
    )

    //Not Found & Error Handler
    EXPRESS_APP.use(NOT_FOUND)
    EXPRESS_APP.use(ERR_HANDLER)

     // Add WebSocket upgrade handlers
     httpServer.on('upgrade', async (req, socket, head) => {
        let cmgrState: IDetailedStatusResponse;
        try {
            cmgrState = await detailedStatus()
        } catch (err) {
            socket.destroy()
             return
        }

        try {
            const sessionID = req.url.replace('/ws/', '').replace('/vnc/', '')
            // check if sessionId is in cache
            const browser = cmgrState.browsers.find((b)=> b.sessionID === sessionID)
            if(!browser || browser.leaseTime === -1) {
                socket.destroy()
                return
            }

            // Handle WebSocket connections for browser debugging
            if (req.url.startsWith('/ws/')) {
                const targetUrl = `ws://${browser.labels.ip}:${browser.ports.browser}/devtools/browser/${browser.labels.wsPath}`
                Logger.info({
                    message: "Proxying WS connection",
                    sessionID,
                    targetUrl
                }, "WS_PROXY_CONNECTION")

                wsProxy.ws(req, socket, head, {
                    target: targetUrl,
                    ws: true,
                    secure: false
                })
            }
            // Handle VNC WebSocket connections
            else if (req.url.startsWith('/vnc/')) {
                const targetUrl = `ws://${browser.labels.ip}:${browser.ports.vnc}`
                Logger.info({
                    message: "Proxying VNC connection",
                    sessionID,
                    targetUrl
                }, "VNC_PROXY_CONNECTION")

                vncProxy.ws(req, socket, head, {
                    target: targetUrl,
                    ws: true,
                    secure: false,
                })
            } else {
                socket.destroy()
                return
            }
        } catch (err) {
            socket.destroy()
            return
        }
    })

    // Server setup
    httpServer.listen(EXPRESS_PORT, () => {
        Logger.info({message: `Scraper Service is Running on: http://localhost:${EXPRESS_PORT}`}, "EXPRESS_APP_RUNNING")
    })
}

export async function shutdown(): Promise<void> {
    return new Promise((resolve) => {
        if (!httpServer) {
            resolve();
            return;
        }

        httpServer.close(async () => {
            if (cache) {
                // Clean up sessions
                const data = cache.data;
                const keys = Object.keys(data);
                
                // Wait for all sessions to be cleaned up
                await Promise.all(keys.map(async (key) => {
                    const session = data[key].v;
                    await freeUpSession(session.browserID);
                    cache.del(session.sessionID);
                }));
            }
            resolve();
        });
    });
}