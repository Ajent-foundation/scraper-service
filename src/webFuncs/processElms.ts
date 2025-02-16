export async function processElms(elms){

    let processedElms = []
    for (let elmIndex in elms){
        try{
            let x = elms[elmIndex].x + elms[elmIndex].width*0.5
            let y = elms[elmIndex].y + elms[elmIndex].height*0.5
            let htmlElement = document.elementFromPoint(x, y)

            // Debug
            console.log("|=================================|")
            console.log(elms[elmIndex].text)
            console.log(htmlElement.tagName)
            //@ts-ignore
            console.log("innerText", htmlElement.innerText)
            console.log("textContent", htmlElement.textContent)
            console.log(htmlElement)
            

            if (htmlElement != null){

                let inputType = ""
                let isIFrame =false
                if (htmlElement instanceof HTMLIFrameElement){
                    let iframeDoc = htmlElement.contentDocument || htmlElement.contentWindow.document
                    let iframeRect = htmlElement.getBoundingClientRect()

                    let adjustedX = x - iframeRect.left
                    let adjustedY = y - iframeRect.top
                    isIFrame = true

                    htmlElement = iframeDoc.elementFromPoint(adjustedX, adjustedY)
                    console.log("IFRAME ELEMENT:", htmlElement)
                    if (htmlElement == null) continue
                    //@ts-ignore
                    //elms[elmIndex].text = htmlElement.innerText
                }
                console.log("================|||================")
                const style = window.getComputedStyle(htmlElement)     
                if(htmlElement.tagName == "IMG") continue
                if(htmlElement.tagName == "DIV") {                  
                    if(!(htmlElement.hasAttribute('onclick') ||
                         htmlElement.hasAttribute('onmousedown') ||
                         htmlElement.hasAttribute('onmouseup') ||
                         htmlElement.hasAttribute('onkeydown') ||
                         htmlElement.hasAttribute('onkeyup') ||
                         style.cursor === 'pointer'
                        )
                    ) continue 
                }
                if(htmlElement.tagName == "INPUT") inputType = htmlElement.getAttribute("type")
                else inputType = htmlElement.getAttribute("role")

                let isVisible = ( style.opacity !== '' &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    htmlElement.getAttribute('aria-hidden') !== 'true' 
                )
                if(!isVisible) continue

                let elmStruct = {
                    x: elms[elmIndex].x,
                    y: elms[elmIndex].y,
                    width: elms[elmIndex].width,
                    height: elms[elmIndex].height,
                    type: htmlElement.tagName,
                    inputType: inputType,
                    text: elms[elmIndex].text,
                    //@ts-ignore
                    innerText: htmlElement.innerText,
                    //htmlElement: htmlElement,
                    isIFrame: isIFrame,
                }
                
                processedElms.push(elmStruct)
            } else continue
        }
        catch(e) { continue }
    }
    
    return processedElms
}