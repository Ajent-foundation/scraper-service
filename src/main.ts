import * as dotenv from 'dotenv'
import { main, shutdown } from './index'

if (require.main === module) {
    // Entrypoint
    (async ()=>{
        // Init env
        let envFilePath = './.env' 
        if (process.argv.length > 2) {
            if (process.argv[2] === "--debug") {
                envFilePath = './.env.dev'
            } 
        }
        
        //InitEnv & constants
        dotenv.config({path: envFilePath})

        await main(
            "Prod", 
            {
                EXPRESS_PORT: process.env.EXPRESS_PORT || "8080"
            },
        )
        
        // ShutdownHandler
        process.once('SIGINT', async() => {
            // Close server
            await shutdown()
            process.exit(0)
        })
    })()
}