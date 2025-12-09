import { CompiledGraph } from "@langchain/langgraph";
import { Logger } from "pino";
import path from "path";
import fs from "fs"

/**
 * Initialize the file debugger
 * @param logger - The logger
 * @param graphName - The name of the graph
 * @returns The log file path and the log to file flag
 */
export function initFileDebugger(
    logger: Logger,
    graphName: string
) {
    const logToFile = process.env['DEBUG_LOGS'] === "true";
    const graphDir = path.join("./generated", graphName);

    let logFilePath = "";
    if(logToFile && fs.existsSync("./generated")) {
        try {
            // Create graph directory if it doesn't exist
            if (!fs.existsSync(graphDir)) {
                fs.mkdirSync(graphDir, { recursive: true });
            }

            // Find the next available index
            const existingLogs = fs.readdirSync(graphDir)
                .filter(file => file.match(/^logs-\d+\.json$/))
                .map(file => parseInt(file.match(/^logs-(\d+)\.json$/)?.[1] || "0"));
            
            const nextIndex = existingLogs.length > 0 ? Math.max(...existingLogs) + 1 : 0;
            logFilePath = path.join(graphDir, `logs-${nextIndex}.json`);

            // Initialize the new log file
            fs.writeFileSync(logFilePath, "[]");
        } catch(error:unknown){
            logger.warn({
                message: error instanceof Error ? error.message : "Error initializing log file",
                stack: error instanceof Error ? error.stack : undefined,
                type: "ERROR_INITIALIZING_LOG_FILE"
            })
        }
    }

    return {
        logFilePath,
        logToFile
    };
}

/**
 * Draw the graph
 * @param logger - The logger
 * @param graphName - The name of the graph
 * @param graph - The graph
 * @param target - The target
 */
export async function drawGraph(
    logger: Logger,
    graphName: string,
    graph: CompiledGraph<any, any, any, any, any, any>,
    target?: string
){
    let timeoutHandle: NodeJS.Timeout | undefined;
    try{
        // Create a timeout promise
        const timeout = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error('Graph drawing timed out after 5 seconds')), 5000);
        });

        // Race between the graph drawing and timeout
        await Promise.race([
            (async () => {
                const diagram = await graph.getGraphAsync({
                    xray: false
                });

                const drawableEdges = []
                for(const edge of diagram.edges){
                    if(
                        !target ||
                        edge.source !== "__start__" || 
                        edge.source === "__start__" && edge.target === target
                    ){
                        drawableEdges.push(edge)
                    }
                }
                diagram.edges = drawableEdges

                const image = await diagram.drawMermaidPng();
                const arrayBuffer = await image.arrayBuffer();
                fs.writeFileSync(`./generated/${graphName}/graph.png`, new Uint8Array(arrayBuffer));
            })(),
            timeout
        ]);
    } catch(error:unknown){
        logger.warn({
            message: "Error drawing graph",
            stack: error instanceof Error ? error.stack : undefined,
            type: "ERROR_DRAWING_GRAPH"
        })
    }

    if(timeoutHandle) {
        clearTimeout(timeoutHandle)
    }
}

