import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { BrowserSession } from '../../apis/browsers-cmgr';
import { BaseRequest } from '../../helpers/Base';
import UTILITY from '../../helpers/utility';
import { connectToBrowser } from '../../browser';
import { getBrowserURL } from '../../apis/browsers-cmgr';
import {
	getCurrentPage,
} from '../../browser/pages';
import { z } from 'zod';
import { SupervisorAgent } from '../../ai/core/SupervisorAgent/index';
import { createBrowserOperator, TBrowserContext } from '../../ai/graphs/orchestrator/index';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { decoder, encoder } from '../../ai/utils';
import { think } from '../../ai/graphs/orchestrator/tools/think';
import { TStopCheckpoint } from '../../ai/core/common';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';
import addFormats from 'ajv-formats';
import Ajv from 'ajv';
import { TGeneralAgent } from '../../ai/prompts/agents/generalAgent';

export const RequestParamsSchema = z.object({});

export const RequestBodySchema = z.custom<BaseRequest>().and(
	z.object({
		state: z.record(z.string(), z.unknown()),
		envVariables: z.record(z.string(), z.string()).optional().describe("The environment variables to use for the AI job"),
		systemPrompt: z.string().describe("The system prompt to use for the outer supervisor agent"),
		browserSystemPrompt: z.string().optional().describe("The system prompt to use for the browser operator agent"),
		userPrompt: z.string().describe("The user prompt to use for the AI job"),
		finalResponseJsonSchema: z.string().describe("The JSON schema to use for the final response"),
		disableGoToPage: z.boolean().optional().default(false).describe("If true, disables the goToPage tool since navigation is already handled"),
	})
);

export const RequestQuerySchema = z.object({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;
export type RequestBody = z.infer<typeof RequestBodySchema>;
export type RequestQuery = z.infer<typeof RequestQuerySchema>;

async function runAiJob(
	req: Request<RequestQuery, {}, RequestBody, RequestQuery>,
	res: Response,
	next: NextFunction,
) {
	// InitVars
	const cache: NodeCache = res.locals.cache;
	const session: BrowserSession = cache.get(res.locals.sessionID);

	// Validate Zod
	try {
		RequestBodySchema.parse(req.body)
		RequestQuerySchema.parse(req.query)
		RequestParamsSchema.parse(req.params)
	} catch (err) {
		next(err);
		return;
	}

	// LOGIC
	try {
		// Get agents from res.locals
		const agents = res.locals.agents;
		if (!agents || !agents.generalAgent) {
			throw new Error("AI agents not initialized");
		}

		// validate final response json schema
		const validatedFinalResponseJsonSchema = validateJsonSchema(JSON.parse(req.body.finalResponseJsonSchema));

		// Initialize browser connection
		const puppeteerBrowser = await connectToBrowser(
			res.log,
			res.locals.importantHeaders ? res.locals.importantHeaders : {},
			getBrowserURL(session),
			res.locals.sessionID,
			session.appPort
		);
		let { page, index } = await getCurrentPage(
			res.log,
			res.locals.importantHeaders ? res.locals.importantHeaders : {},
			puppeteerBrowser,
			session.config,
		);

		// Create global context for SupervisorAgent
		const globalContext: TBrowserContext = {
			ctx: {
				logger: res.log,
				addAsExample: false,
				shouldRunFromConfiguredProviders: false,
				configuredProviders: {},
			},
			session: session,
			sessionID: res.locals.sessionID,
			importantHeaders: res.locals.importantHeaders,
			puppeteerBrowser: puppeteerBrowser,
			page: page,
			pageIndex: index,
			envVariables: req.body.envVariables,
		};

		const agent = (agents.generalAgent as unknown as TGeneralAgent).overrideProvider({
			provider: "ConfidentialPhalaLLM",
			model: "phala/deepseek-chat-v3-0324",
			temperature: 1.0,
		})
		//const agent = (agents.generalAgent as unknown as TGeneralAgent).overrideProvider({
		//	provider: "OpenAI",
		//	model: "gpt-4o",
		//	temperature: 1.0,
		//})

		// Create browser operator as a subagent with browser system prompt
		const browserOperator = createBrowserOperator(
			globalContext,
			agent,
			page.url(),
			req.body.browserSystemPrompt,
			req.body.disableGoToPage
		);

		// Get page info for context
		const pageInfo: string[] = [];
		try {
			const url = page.url();
			pageInfo.push(`Current page URL: ${url}`);
		} catch {}
		pageInfo.push(`Session ID: ${res.locals.sessionID}`);
		if (index !== undefined) {
			pageInfo.push(`Page index: ${index}`);
		}
		
		// Add environment variables info if available
		if (req.body.envVariables && Object.keys(req.body.envVariables).length > 0) {
			pageInfo.push(`\nAvailable Environment Variables (use $variableName format):`);
			Object.keys(req.body.envVariables).forEach(key => {
				pageInfo.push(`  - $${key} (masked value available)`);
			});
		}

		const finalResponseJsonSchema = convertJsonSchemaToZod(validatedFinalResponseJsonSchema);

		// Create stop checkpoint for task completion
		const stopZodSchema = z.object({
			summary: z.string().describe("A summary of the actions taken to accomplish the task"),
			response: finalResponseJsonSchema.optional().describe("The final answer or result of completing the task"),
			isCriticalError: z.boolean().optional().default(false).describe("Whether this is critical error that prevents task completion"),
		});
		const stopCheckpoint: TStopCheckpoint<TBrowserContext, typeof stopZodSchema> = {
			parameters: stopZodSchema,
			evaluator: async (global, args) => {
				return undefined;
			},
		};
		
		// Create main supervisor agent with browser operator as a subagent and think tool
		const supervisorAgent = new SupervisorAgent<TBrowserContext>(
			globalContext,
			{
				name: "AI Job Supervisor",
				expertise: "Orchestrating AI tasks and delegating to specialized agents",
				role: "A supervisor that coordinates tasks and delegates to specialized agents like the Browser Operator",
				tools: "Access to Browser Operator agent for browser automation tasks, and think tool for planning and reasoning",
				guidelines: req.body.systemPrompt,
				context: pageInfo.join("\n"),
			},
			req.body.userPrompt,
			agent,
			[browserOperator, think], // Browser operator as a subagent + think tool
			stopCheckpoint, // Stop checkpoint for task completion
			false, // shouldUseTodos - TODO functionality disabled
		);

		const state = decoder(req.body.state);

		// Process the chat with supervisor agent
		const existingMessages = state.messages && Array.isArray(state.messages) ? state.messages : [];
		const messages = [
			...existingMessages,
			new HumanMessage({
				content: [
					{
						type: "text",
						text: req.body.userPrompt,
					}
				]
			})
		];

		const result = await supervisorAgent.graph.invoke({
			objective: req.body.userPrompt,
			messages: messages,
		}, {
			recursionLimit: 25,
			tags: [
				`browser_ai_job_${res.locals.sessionID}`,
			],
			metadata: {
				sessionID: res.locals.sessionID,
			},
		});

		// find last human message
		const lastHumanMessage = result.messages[result.messages.length - 1];
		let parsedResponse: string | undefined;
		try {
			parsedResponse = JSON.parse(lastHumanMessage?.content.toString() || "{}");
		} catch {}

		// Log result and lastHumanMessage for debugging
		res.log.info({
			result,
			lastHumanMessage
		}, "runAiJob");
		
		const finalState = encoder({
			// discard last human message
			messages: [
				...result.messages.slice(0, -1),
				new AIMessage(lastHumanMessage?.content || "Task completed."),
			],
		});

		// log success
		res.locals.httpInfo.status_code = 200;

		// Return response
		UTILITY.EXPRESS.respond(res, 200, {
			state: finalState,
			finalAnswer: lastHumanMessage?.content || "Task completed.",
			parsedResponse
		});
	} catch (error) {
		// log Error
		res.locals.httpInfo.status_code = 500;
		res.log.error({
			...(res.locals.importantHeaders ? res.locals.importantHeaders : {}),
			message: error instanceof Error ? error.message : "Unknown error",
			stack: error instanceof Error ? error.stack : undefined,
		}, "ENDPOINT_ERROR")

		UTILITY.EXPRESS.respond(res, 500, {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Internal Server Error',
		});
	}

	// Move to next function
	next();
}

export default runAiJob;


function validateJsonSchema(schema: unknown): Record<string, unknown> {
	try {
		// Check if schema is an object
		if (!schema || typeof schema !== 'object') {
			throw new Error('Schema must be an object');
		}
		
		// Initialize AJV validator
		const ajv = new Ajv({ allErrors: true, strict: true });
		addFormats(ajv);
		
		// Try to compile the schema to validate it
		// Cast to unknown first, then to the expected type
		ajv.compile(schema as unknown as Record<string, unknown>);
		
		// If compilation succeeds, return the original schema
		return schema as Record<string, unknown>;
	} catch (error) {
		return {
			type: "object",
			properties: {},
			required: []
		};
	}
}