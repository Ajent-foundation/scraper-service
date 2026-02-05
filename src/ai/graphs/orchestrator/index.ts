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
    
    // Build tools description (screenshot, getElms, and tabs are auto-run after every action; not exposed as tools)
    const toolsDescription = disableGoToPage
        ? "Browser automation tools including: click (click elements), type (type text), scroll (scroll pages), move (move mouse), wait (wait for delays), goBack (navigate back), pressEnter (press Enter key to submit forms), pressEscape (press Escape key to close popups), switchTab (switch to a tab by index), closeTab (close current tab), captureDataScreenshot (capture and label a screenshot to record/remember data or page state). Note: Navigation is already handled, so goToPage is not available. After each action you will see the current page (screenshot, elements, and tab list if multiple tabs are open)."
        : "Browser automation tools including: goToPage (navigate to URLs), click (click elements), type (type text), scroll (scroll pages), move (move mouse), wait (wait for delays), goBack (navigate back), pressEnter (press Enter key to submit forms), pressEscape (press Escape key to close popups), switchTab (switch to a tab by index), closeTab (close current tab), captureDataScreenshot (capture and label a screenshot to record/remember data or page state). After each action you will see the current page (screenshot, elements, and tab list if multiple tabs are open).";
    
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

NEVER GUESS VALUES - STOP AND ASK:
- If a page asks for a code, OTP, PIN, or any value you don't have - DO NOT TYPE ANYTHING
- Only type values from: $variableName environment variables OR values explicitly given in your task
- If you don't have a value, STOP and report that user input is required
- NEVER make up or guess codes - this will cause failures

CRITICAL RULES:
1. ALWAYS stay focused on the exact task given - DO NOT deviate or add extra steps
2. Use the page elements and screenshot you receive before each decision to see what's on the page
3. Use the screenshot and elements data to understand the CURRENT state of the page - NOT what might come next
4. ACCURACY IS CRITICAL: You must identify EXACTLY what is currently visible on the page
${disableGoToPage ? "5. Navigation is already handled - you are already on the correct page. DO NOT try to navigate." : "5. Navigate to pages using goToPage when needed"}
6. Click elements using their coordinates from the elements data you receive
7. Type text into input fields using type${envVarsInfo ? " - use $variableName format for credentials" : ""}
8. Scroll pages when content is not visible
9. Wait for page loads and dynamic content when necessary
10. Complete each action fully (type → submit)
11. Always explain what you're doing and why

WORKFLOW:
- You will receive the current page (screenshot and elements) before each decision
- Identify EXACTLY what the page is asking for RIGHT NOW
- If the page asks for a value you don't have, STOP and ask for user input
- Execute actions step by step (${disableGoToPage ? "click, type, pressEnter, etc." : "navigate, click, type, pressEnter, etc."})
- Report back what was accomplished${envVarsInfo}`;

    // Combine default guidelines with bank-specific context if provided
    let finalGuidelines = defaultGuidelines;
    if (browserSystemPrompt) {
        // If bank-specific context is provided, append it to default guidelines
        finalGuidelines = `${defaultGuidelines}\n\n${browserSystemPrompt}`;
    }

    // Auto-run screenshot + getElms + tab info after every action; pass as last message in invoke only (never push to state.messages)
    const getCurrentStateMessage = async (global: TBrowserContext): Promise<HumanMessage | null> => {
        const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
            { type: "text", text: "What to do next now?" },
        ];
        
        // Add tab info if there are multiple tabs
        try {
            const pages = await global.puppeteerBrowser.pages();
            if (pages.length > 1) {
                const tabsInfo: string[] = [];
                for (let i = 0; i < pages.length; i++) {
                    const page = pages[i];
                    try {
                        const title = await page.title();
                        const url = page.url();
                        const isCurrent = page === global.page;
                        tabsInfo.push(`${isCurrent ? "→ " : "  "}[${i}] ${title || "(No title)"} - ${url}`);
                    } catch (e) {
                        tabsInfo.push(`  [${i}] (Error reading tab)`);
                    }
                }
                content.push({ type: "text", text: `⚠️ Multiple tabs open (${pages.length}):\n${tabsInfo.join("\n")}\nUse closeTab to close unwanted tabs, or switchTab to switch.` });
            }
        } catch (e) {
            // Ignore tab listing errors
        }
        
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
