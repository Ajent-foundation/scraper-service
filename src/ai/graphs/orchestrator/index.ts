import { HumanMessage } from "@langchain/core/messages";
import { SupervisorAgent } from "../../core/SupervisorAgent/index";
import { TGeneralAgent } from "../../prompts/agents/generalAgent";
import { browserTools, getElms, screenshot } from "./tools/index";
import { TBrowserContext } from "./types";
import { TStopCheckpoint } from "../../core/common/index";
import { z } from "zod";

/**
 * Creates a BrowserOperator SupervisorAgent configured with browser automation tools
 */
export function createBrowserOperator(
    globalContext: TBrowserContext,
    llm: TGeneralAgent,
    currentPageUrl?: string,
    browserSystemPrompt?: string,
    disableGoToPage: boolean = false
): SupervisorAgent<TBrowserContext> {
    const stopZodSchema = z.object({
        response: z.string().describe("The final answer or result of completing the browser automation task. CRITICAL: If the page requires user input (MFA, OTP, multiple choice selection, etc.), you MUST include detailed information about what is currently on the page. Describe EXACTLY what the page is asking for, including: the question/prompt text, available options if it's a multiple choice, the input type needed (code entry, selection, etc.). This information is essential for the parent supervisor to build the userInputs response correctly."),
        summaryOfActions: z.string().describe("A summary of the actions taken to accomplish the task. Include details about the current page state, especially if user input is required."),
        isCriticalError: z.boolean().optional().default(false).describe("Whether this is a critical error that prevents task completion"),
    });
    // Create stop checkpoint for browser operator
    const stopCheckpoint: TStopCheckpoint<TBrowserContext, typeof stopZodSchema> = {
        parameters: stopZodSchema,
        evaluator: async (global, args) => {
            return undefined; // Allow stop
        },
    };

    // Filter tools based on disableGoToPage flag
    const toolsToUse = disableGoToPage 
        ? browserTools.filter(tool => tool.name !== "goToPage")
        : browserTools;
    
    // Build tools description (screenshot and getElms are auto-run after every action; not exposed as tools)
    const toolsDescription = disableGoToPage
        ? "Browser automation tools including: click (click elements), type (type text), scroll (scroll pages), move (move mouse), wait (wait for delays), and goBack (navigate back to previous page). Note: Navigation is already handled, so goToPage is not available. After each action you will see the current page (screenshot and elements) and decide what to do next."
        : "Browser automation tools including: goToPage (navigate to URLs), click (click elements), type (type text), scroll (scroll pages), move (move mouse), wait (wait for delays), and goBack (navigate back to previous page). After each action you will see the current page (screenshot and elements) and decide what to do next.";
    
    // Build environment variables info for context
    const envVarsInfo = globalContext.envVariables && Object.keys(globalContext.envVariables).length > 0
        ? `\n\nAVAILABLE ENVIRONMENT VARIABLES (use $variableName format):
${Object.keys(globalContext.envVariables).map((key) => `  - $${key} (masked value available)`).join('\n')}

CRITICAL - YOUR JOB IS TO SELECT, NOT TO GUESS:
- You MUST choose one of the $variableName placeholders listed above (e.g., ${Object.keys(globalContext.envVariables).map(k => `$${k}`).join(', ')}). Your job is ONLY to select which variable to use—never invent or type the actual value.
- NEVER guess values. If the page needs a value that could come from the list (provider, key, API key, username, password, token, etc.), use a $variableName from the list above. If a value is not in the list, you do NOT have it—only use what is provided.
- The system will automatically replace $variableName with the actual value when you type it.

SMART MAPPING - MATCH FORM FIELDS TO THE BEST AVAILABLE VARIABLE:
- The form label may not exactly match a variable name. Map by meaning and use the best available variable from the list.
- Examples: "Provider" or "Service" → $provider if you have it. "API Key" or "Key" → $key or $apiKey. "Login ID" or "User ID" → $username. "Passkey" or "PIN" → $password. Pick the closest match from the AVAILABLE ENVIRONMENT VARIABLES list—do not ask for or invent other values.`
        : "";
    
    // Build guidelines with navigation note if disabled
    const defaultGuidelines = `You are a browser automation specialist. Your goal is to accomplish the exact task given to you by intelligently using browser tools.

CRITICAL RULES:
1. ALWAYS stay focused on the exact task given - DO NOT deviate or add extra steps
2. Start by understanding what the user wants to accomplish
3. Use the page elements and screenshot you receive before each decision to see what's on the page
4. Use the screenshot and elements data to understand the CURRENT state of the page - NOT what might come next
5. ACCURACY IS CRITICAL: You must identify EXACTLY what is currently visible on the page, not what you think will happen next
${disableGoToPage ? "6. Navigation is already handled - you are already on the correct page. DO NOT try to navigate." : "6. Navigate to pages using goToPage when needed"}
7. Click elements using their coordinates from the elements data you receive
8. Type text into input fields using type${envVarsInfo ? "\n   - For sensitive values (username, password, etc.), use the $variableName format from available environment variables" : ""}
9. Scroll pages when content is not visible
10. Wait for page loads and dynamic content when necessary
11. You will receive the current page (screenshot and elements) before each decision—use it to verify actions and show progress
12. Complete ONLY what is asked - do not add unnecessary actions
13. Always explain what you're doing and why${envVarsInfo ? "\n14. When filling forms with credentials, ALWAYS use $variableName format (e.g., $username, $password) - never type actual values" : ""}
${envVarsInfo ? "15" : "14"}. REMEMBER THIS DEVICE - AUTOMATIC HANDLING: If you see any prompt asking to "remember this device", "save this device", "trust this device", or similar, you MUST AUTOMATICALLY select "No", "Don't remember", "Don't save", or the equivalent negative option WITHOUT asking the user. This should be handled automatically as part of the login flow - DO NOT return this as a userInput. Simply click the "No" option and continue. NEVER select "Yes" or "Remember" for device remembering prompts.

USER INPUT REQUIREMENTS - CRITICAL:
- When the page asks for user input, you MUST identify EXACTLY what is currently visible on the page
- Return user inputs ONLY for what is currently needed on the current page, NOT for future steps
- If the page asks "How would you like to receive the code?" - return multiple_choice for THAT question
- If the page asks "Enter the code" - return otp for THAT question
- DO NOT skip ahead or assume what will come next - handle ONLY what is currently visible
- Check the page carefully: if it's asking for method selection, return multiple_choice. If it's asking for code entry, return otp.
- The user inputs you return must match EXACTLY what the page is currently asking for
- DO NOT return userInputs for "remember this device" prompts - these should be handled automatically by selecting "No" (see rule ${envVarsInfo ? "15" : "14"})

RESPONSE DESCRIPTION REQUIREMENTS - CRITICAL:
- When you return a response via the stop checkpoint, you MUST include detailed information about the current page state
- If user input is required, describe EXACTLY what the page is asking for in your response text:
  * The exact question/prompt text visible on the page
  * If it's a multiple choice, list ALL available options (e.g., "Text" and "Call")
  * If it's code entry, specify what type of code (OTP, PIN, etc.)
  * The input field type and any relevant details
- This detailed description is essential because you are a sub-agent - the parent supervisor needs this information to build the userInputs response correctly
- Be specific: "The page asks 'How would you like to receive your authorization code?' with options: 'Text to mobile' and 'Call to mobile'" is better than "The page requires user input"

WORKFLOW:
- You will receive the current page (screenshot and elements) before each decision—use it to understand the CURRENT page state
- Identify EXACTLY what the page is asking for RIGHT NOW
- Plan your actions based on the EXACT task objective and CURRENT page state
- Execute actions step by step (${disableGoToPage ? "click, type, etc." : "navigate, click, type, etc."}) - ONLY what's needed
- Report back what was accomplished

IMPORTANT: Stay focused on the task. Do not deviate from what is requested. Complete the task efficiently without adding unnecessary steps.${envVarsInfo}`;

    // Combine default guidelines with bank-specific context if provided
    let finalGuidelines = defaultGuidelines;
    if (browserSystemPrompt) {
        // If bank-specific context is provided, append it to default guidelines
        finalGuidelines = `${defaultGuidelines}\n\n${browserSystemPrompt}`;
    }

    // Auto-run screenshot + getElms after every action; pass as last message in invoke only (never push to state.messages)
    const getCurrentStateMessage = async (global: TBrowserContext): Promise<HumanMessage | null> => {
        const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
            { type: "text", text: "What to do next now?" },
        ];
        try {
            const screenshotResult = await screenshot.implementation(global, {}, {} as any);
            const screenshotData = typeof screenshotResult === "string" ? { text: screenshotResult, base64Images: [] as string[] } : screenshotResult;
            for (const url of screenshotData.base64Images) {
                content.push({ type: "image_url", image_url: { url } });
            }
        } catch (e) {
            content.push({ type: "text", text: "(Screenshot failed)" });
        }
        try {
            const getElmsResult = await getElms.implementation(global, { fullPage: false }, {} as any);
            const elmsData = typeof getElmsResult === "string" ? { text: getElmsResult, base64Images: [] } : getElmsResult;
            content.push({ type: "text", text: elmsData.text });
        } catch (e) {
            content.push({ type: "text", text: "(Get elements failed)" });
        }
        return new HumanMessage({ content });
    };
    
    return new SupervisorAgent<TBrowserContext>(
        globalContext,
        {
            name: "browserOperator",
            expertise: "Browser automation and web interaction. Specializes in navigating web pages, clicking elements, and extracting data.",
            role: "A browser automation specialist that can navigate web pages, interact with elements, and extract information to accomplish user objectives.",
            tools: toolsDescription,
            guidelines: finalGuidelines,
            context: currentPageUrl ? `Current page URL: ${currentPageUrl}${envVarsInfo}` : envVarsInfo || undefined,
        },
        "Accomplish the exact browser automation task given without deviating",
        llm,
        toolsToUse,
        stopCheckpoint,
        false,
        undefined,
        undefined,
        {
            enabled: true,
            maxTokens: 100000,
        },
        getCurrentStateMessage
    );
}

export { browserTools } from "./tools/index";
export { TBrowserContext } from "./types";
