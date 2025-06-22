import { Page } from 'puppeteer';
import { setMousePosition } from '../../ghostCursor';
import { GhostCursor } from 'ghost-cursor';
import { Logger } from 'pino';

export interface IBody {
    x: number;
    y: number;
    factor: number;
    axis: string;
}

export default async function execute(page: Page, cursor:GhostCursor, body: IBody, log: Logger) {
    // Move the cursor to the position
    if (cursor) {
        await cursor.moveTo({ x: body.x, y: body.y });

        const pos = cursor.getLocation()
        await setMousePosition(page, pos.x, pos.y);
    } else {
        await page.mouse.move(body.x, body.y);
    }

    // Get Element at Position (x,y)
    const scrollSize = await page.evaluate((x,y) => {
        try{
        const element = document.elementFromPoint(x, y);
        if(element) {
            function isDistantParent(parent:HTMLElement, child:HTMLElement) {
                let cur = child
                while(cur !== null) {
                    if(cur === parent) {
                        return true
                    }
        
                    if (cur.tagName.toUpperCase() === "BODY") {
                        break;
                    }
        
                    cur = cur.parentElement
                }
                return false
            }

            function getScrollContainerProperties(element:HTMLElement){
                const computedStyle = window.getComputedStyle(element);
                if(
                    computedStyle["overflowY"] === 'scroll' || computedStyle["overflowY"] === 'auto',
                    computedStyle["overflowX"] === 'scroll' || computedStyle["overflowX"] === 'auto'
                ) {  
                    if (
                        element.scrollHeight > element.clientHeight || 
                        element.scrollWidth > element.clientWidth
                    ) {
                        const verticalScrollableAmount = element.scrollHeight - element.clientHeight;
                        const horizontalScrollableAmount = element.scrollWidth - element.clientWidth;
        
                        return {
                            x: {
                                // Y-Scroll Properties
                                hasYScroll: verticalScrollableAmount > 0,
                                scrollTop: element.scrollTop,
                                verticalScrollableAmount: verticalScrollableAmount,
                            },
                            y: {
                                // X-Scroll Properties
                                hasXScroll: horizontalScrollableAmount > 0,
                                scrollLeft: element.scrollLeft,
                                horizontalScrollableAmount: horizontalScrollableAmount,
                            },
        
                            // Needed for calculations
                            scrollHeight: element.scrollHeight,
                            clientHeight: element.clientHeight,
                            
                            // Needed for calculations
                            clientWidth: element.clientWidth,
                            scrollWidth: element.scrollWidth,
                        }
                    }
                }
        
                return null
            }

            const scrollableInnerElements : HTMLElement[] = []
            document.querySelectorAll('*').forEach(function(element) {
                const htmlElement = element as HTMLElement;
                if (getScrollContainerProperties(htmlElement)) {
                    scrollableInnerElements.push(htmlElement);
                }
            });

            for (const scrollContainer of scrollableInnerElements) {
                if(isDistantParent(scrollContainer, element as HTMLElement)){
                    // GET Container Height
                    const containerHeight = scrollContainer.clientHeight;
                    return containerHeight
                }
            }
        }

            return -1
        } catch (error) {
            return -1
        }
    }, body.x, body.y);

    // Scroll at the position using mouse wheel
    const scrollBy = (body.factor===-1) ?
        (scrollSize===-1) ? 
            100 
            : 
            scrollSize
        :
        body.factor * 100
    
    await page.mouse.wheel({
        deltaY: body.axis === 'up' ? -scrollBy : scrollBy,
    });

    log.info("scrollBy", scrollBy)
    log.info("scrollSize", scrollSize)
    log.info("body", body)

    console.log("scrollBy", scrollBy)
    console.log("scrollSize", scrollSize)
    console.log("body", body)

    return {}
}