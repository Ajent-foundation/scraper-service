import { Response } from 'express'
import { readFileSync, accessSync, writeFileSync} from 'fs'
import * as crypto from 'crypto'

const UTILITY = {
    EXPRESS: {
      respond: async (res:Response, status:number, requestBody:any) => {
        res.status(status).send(requestBody)
      }
    },
    CRYPTO:{
        hashFile: (data:string) => {
            const hash = crypto.createHash('md5')
            hash.update(data)
            return hash.digest('hex')
        }
    },
    FILE: {
        readFile: (path:string) => {
            const data = readFileSync(path).toString()
            return data
        },
        loadJSON: (path:string) => {
            const data = readFileSync(path).toString()
            return JSON.parse(data)
        },
        saveJSON: (path:string, data:any) => {
            const dataStr = JSON.stringify(data, null, 4)
            writeFileSync(path, dataStr)
        },
        loadJSONSchema: (path:string) => { 
            try{
                accessSync(path)
                const data = readFileSync(path).toString()
                return JSON.parse(data)
            } catch(err){
                return {
                    "type": "object",
                    "additionalProperties": false
                }
            }
        },
        exePythonScript: ( fileName:string, args: string[]=[] ) =>{
            const spawn = require("child_process").spawn
            let p = spawn('python', [fileName].concat(args))
            let result = {}

            return new Promise((resolveFunc) => {
                p.stdout.on("data", (__result) => {
                    result = JSON.parse(__result.toString())
                })
                p.stderr.on("data", () => {
                    result = -1
                })
                p.on("exit", () => {
                    if(result == -1) throw new Error("Error in drawing image")
                    resolveFunc(result)
                })
            })
        }
    }
}

export default UTILITY

