import { TZodBaseToolDefinition } from "../../../core/common/index";
import { TBrowserContext } from "../types";
import { getBrowserAndPage } from "../utils";
import { VIEW_PORT } from "../../../../browser/index";
import actionImpl from "../../../../browser/interface/impl/index";
import { configureGhostCursor } from "../../../../browser/interface/ghostCursor/index";
import { GetElmsType } from "../../../../browser/interface/types";
import type { GhostCursor } from "ghost-cursor";
import { z } from "zod";

export const getElms: TZodBaseToolDefinition<TBrowserContext, any, any> = {
    name: "getElms",
    description: "Get all interactive elements from the current page. This returns elements with their positions, text, and interactivity information. Use this to understand what's on the page before clicking or interacting.",
    zodParameters: z.object({
        fullPage: z.boolean().optional().describe("Whether to get elements from the full page (not just viewport)"),
    }),
    implementation: async (global, args) => {
        const { browser, page } = await getBrowserAndPage(global);
        const viewPort = global.session.config?.viewport || VIEW_PORT;

        // Configure cursor if needed (following executeCommands pattern)
        let cursor: GhostCursor | null = null;
        if (global.session.config?.ghostCursor) {
            cursor = await configureGhostCursor(page, global.session.config.cursorConfig);
        }

        // Use existing implementation (following executeCommands pattern)
        // Always use BySimplifyingDom
        const result = await actionImpl.getElms(
            global.ctx.logger,
            global.importantHeaders || {},
            page,
            browser,
            cursor!,
            {
                type: GetElmsType.BySimplifyingDom,
                config: global.session.config,
                viewPort: {
                    width: viewPort.width,
                    height: viewPort.height,
                },
                fullPage: args.fullPage,
            }
        );

        return { text: JSON.stringify({
            message: `Got ${result.elms?.length || 0} elements from the page`,
            instructions: `JSON structure of an HTML element\n` +
                'c = classes of the element\n' +
                'id = html id of element\n' +
                'w = width\n' +
                'h = height\n' +
                't = tag name (div, span, etc.)\n' +
                'k = clickable (0 = not clickable, 1 = clickable)\n' +
                'tx = text of element\n' +
                'href = href of element\n' +
                'src = src of element\n' +
                'x = x position of element center (middle point)\n' +
                'y = y position of element center (middle point)\n' +
                'i = index of the element\n',
            elements: pruneDomList(result.elms || []),
        }), base64Images: [] };
    },
};

function pruneDomList(x:any[]) {	
	for (var i = 0; i < x.length; i++) {
		if (typeof x[i] == 'string') {
			x[i] = JSON.parse(x[i]);
		}

		// sometimes the string is double parsed. both the array was parsed and then the element objects were parsed again
		if (typeof x[i] == 'string') {
			x[i] = JSON.parse(x[i]);
		}

		delete x[i].index;
		delete x[i].isIframe;
		delete x[i].iframePosition;
		x[i].w = x[i].width;
		delete x[i].width;
		x[i].h = x[i].height;
		delete x[i].height;
		x[i].t = x[i].tagName;
		delete x[i].tagName;
		
		if(typeof x[i].interactivity != 'undefined') {
			x[i].k = x[i].interactivity[0];
			delete x[i].interactivity;

			if (x[i].k == 'clickable') {
				x[i].k = 1;
			} else {
				x[i].k = 0;
			}
        }

		// Calculate adjusted x and y to center point (middle of width and height)
		const originalX = parseInt(x[i].x);
		const originalY = parseInt(x[i].y);
		const width = parseInt(x[i].w);
		const height = parseInt(x[i].h);
		
		x[i].x = originalX + Math.floor(width / 2);
		x[i].y = originalY + Math.floor(height / 2);
		x[i].w = width;
		x[i].h = height;
		delete x[i].inputType;

		x[i].c = x[i].class;
		delete x[i].class;
		if(typeof x[i].c != 'string') {
			delete x[i].c;
		}

		x[i].tx = x[i].text;
		delete x[i].text;

		if(typeof x[i].src != 'undefined' && x[i].src != null) {
			
			x[i].src = x[i].src.replace('https://www.', '').replace('https://.', '');
		}

		if (typeof x[i].href != 'undefined' && x[i].href != null) {
			x[i].href = x[i].href.replace('https://www.', '').replace('https://.', '');
		}

		// loop through all the variables. any variable that has an empty value should be deleted
		Object.keys(x[i]).forEach(function(key,index) {
			if(x[i][key] === '') {
				delete x[i][key];
			}
		});

		x[i].i = i;

		// check if domJSON has an src attribute
		if (typeof x[i].src != 'undefined') {

			if (x[i].src != null) {
				// check if the src is a base64 string
				if (x[i].src.includes('data:image')) {
					// if it is, then remove it
					delete x[i].src;
				}
			}

		}

		/* 
		if an element only has 
		h
		t
		w
		x
		y
		and nothing else, remove it 
		*/

		if (hasOnlySpecifiedAttributes(x[i])) {
			delete x[i];
		}

		x = removeDuplicateStringsFromObject(x);
	}

	return x;
}

// this is a useless element probably
function hasOnlySpecifiedAttributes(obj:any) {
	const allowedAttributes = ['h', 't', 'w', 'x', 'y'];
	const objAttributes = Object.keys(obj);
	return JSON.stringify(objAttributes.sort()) === JSON.stringify(allowedAttributes.sort());
}


function removeDuplicateStringsFromObject(obj:any) {
	for (let key in obj) {
		if (typeof obj[key] === 'string') {
			let words = obj[key].split(' ');
			let uniqueWords = [...new Set(words)];
			obj[key] = uniqueWords.join(' ').trim();
		}
	}
	return obj;
}