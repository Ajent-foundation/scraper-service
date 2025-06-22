export function simplifyDOM(
    // The DOM elements to be captured that falls inside the bounding box
    bbox:{
        x: number,
        y: number,
        width: number,
        height: number,
    } | null,
    newReturn: boolean = false
) : any {
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

    const LABELS = {
        'TEXT': 0,
        'CODE': 1,
        'LINK': 2,
        'IMAGE': 3,
        'VIDEO': 4,
        'AUDIO': 5,
        'BUTTON': 6,
        'INPUT': 7,
        'FORM': 8,
        'QUOTE': 9,
        'CUSTOM': 10,
        'ICON': 11,
        'HEADER': 12,
        'SUBMIT': 13,
        'FOOTER': 14,
        'NAV': 15,
        'LIST':16,
        'SELECT' : 17,
    }
    
    class ELM {
        el: any
        bbox: {
            x: number,
            y: number,
            width: number,
            height: number,
            left: number,
            top: number,
        }
        label: number
        description: string
        text : string
        isElmClickable: boolean
        isElmTriggerable: boolean
        inputType: string
        tagName: string
        index: number
        isIFrame: boolean
        iframePosition: {
            x: number,
            y: number
        }
        scrollContainer: HTMLElement | null

        // Leaf node segment of "semantic content"
        constructor(el: any, index:number, isIFrame:boolean, iframePosition:{ x: number, y: number }, scrollContainer=null, offset=0){
            this.index = index
            this.el = el
            this.bbox = this.getBoundingBox(el)
            this.label = this.getLabel(el)
            this.description = this.getDescription(el)
            this.text = this.getText(el)
            this.isElmClickable = this.isClickable(el)
            this.inputType = this.getInputType(el)
            this.tagName = el.tagName
            this.isElmTriggerable = this.isTriggerable(el)
            this.scrollContainer = scrollContainer

            // If the element is inside an iframe
            this.isIFrame = isIFrame
            this.iframePosition = iframePosition

            if (offset !== 0) this.bbox.y += offset
        }

        isTriggerable(el){
            try{
                const style = window.getComputedStyle(el) 
                let hasClickEvent = (
                    el.getAttribute('onclick') != null || 
                    el.getAttribute('href') != null ||
                    el.getAttribute('onmousedown') != null ||
                    el.getAttribute('onmouseup') != null ||
                    el.getAttribute('onkeydown') != null ||
                    el.getAttribute('onkeyup') != null ||
                    style.cursor === 'pointer'
                )
                if (hasClickEvent) return true
                else if (el.parentElement) hasClickEvent = this.isClickable(el.parentElement)
                return hasClickEvent
            } catch (e) {
                return false
            }
        }
        isClickable(el){
            try{
                const style = window.getComputedStyle(el) 
                let hasClickEvent = (
                    el.getAttribute('onclick') != null || 
                    el.getAttribute('href') != null ||
                    el.getAttribute('onmousedown') != null ||
                    el.getAttribute('onmouseup') != null ||
                    el.getAttribute('onkeydown') != null ||
                    el.getAttribute('onkeyup') != null ||
                    style.cursor === 'pointer'
                )
                if (hasClickEvent) return true
                else if (el.parentElement) hasClickEvent = this.isClickable(el.parentElement)
                else if (el.tagName === 'INPUT')
                return hasClickEvent
            } catch (e) {
                return false
            }
        }
        getBoundingBox(el){
            let _bbox = el.getBoundingClientRect()
            if(_bbox.width == 0 || _bbox.height == 0) return el.parentElement.getBoundingClientRect()
            else return _bbox
        }
        getLabel(el){
            try{
                const data = {
                    'tagName': el.tagName.toUpperCase(),
                    'parentTagName': el.parentElement.tagName.toUpperCase(),
                    'classlist': el.classList,
                    'hasText': el.textContent.trim() !== '',
                    'el': el
                }

                // Classify the semantic content of the node
                if (data.tagName == "SELECT") return LABELS.SELECT
                if (this.isHeader(data)) return LABELS.HEADER
                if (this.isCode(data)) return LABELS.CODE
                if (this.isQuote(data)) return LABELS.QUOTE
                if (this.isList(data)) return LABELS.LIST
                if (this.isButton(data)) return LABELS.BUTTON
                if (this.isLink(data)) return LABELS.LINK
                if (this.isInput(data)) return LABELS.INPUT
                if (this.isText(data)) return LABELS.TEXT
                if (this.isImage(data)) return LABELS.IMAGE
                if (this.isIcon(data)) return LABELS.ICON
                if (this.isCustom(data)) return LABELS.CUSTOM

                // Nodes whose labels are their tagname
                if (['VIDEO', 'AUDIO', 'FORM', 'NAV', 'FOOTER'].includes(data.tagName)) return LABELS[data.tagName]

                return data.tagName

            } catch (e) {

                return '';

            }
        }
        isButton(data){
            // Should go after a link check
            try {
                let tagName = data.tagName
                let classlist = data.classlist
                let role = data.el.getAttribute('role')
                let type = data.el.getAttribute('type')
                if (type) type = type.toLowerCase()
                if (role) role = role.toLowerCase()

                //@ts-ignore
                let hasClickEvent = (window.getEventListeners && window.getEventListeners(data.el)['click'])
                let isInputButton = tagName == 'INPUT' && (type == 'button' || type == 'submit')
                return tagName.toLowerCase() == 'button' || role == 'button' || isInputButton || (tagName == 'a' && (classlist.contains('btn') || classlist.contains('button'))) || hasClickEvent
            } catch (e) {
                return false
            }
        }
        isInput(data){
            try{ 
                let tagName = data.tagName
                return tagName == 'INPUT' || tagName == 'SELECT' || tagName == 'OPTION' || tagName == 'TEXTAREA'
            } catch (e) {
                return false
            }
        }
        isCustom(data){
            try{ 
                let tagName = data.tagName
                return window.customElements.get(tagName.toLowerCase())
            } catch (e) {
                return false
            }
        }
        isText(data){
            try { 
                let tagName = data.tagName
                let hasText = data.hasText
                return hasText && (tagName == 'P' || tagName == 'SPAN' || tagName == 'ABBR' || tagName == 'LABEL' || tagName == 'DIV'|| tagName == 'LI')
            } catch (e) {
                return false
            }
        }
        isLink(data){
            try{
                let tagName = data.tagName
                let parentTagName = data.parentTagName
                let classlist = data.classlist

                let linkNotButton = (tagName == 'A' && !classlist.contains('btn') && !classlist.contains('button'))
                let parentIsLink = (parentTagName == 'A' && (tagName == 'P' || tagName == 'SPAN' || tagName == 'ABBR' || tagName == 'ADDRESS'))
                let citeElement = (tagName == 'CITE')
                return linkNotButton || parentIsLink || citeElement
            } catch (e) {
                return false
            }
        }
        isHeader(data){
            try {
                let tagName = data.tagName
                let parentTagName = data.parentTagName
                let hasText = data.hasText

                let isHeader = (hasText && (tagName == 'H1' || tagName == 'H2' || tagName == 'H3' || tagName == 'H4' || tagName == 'H5' || tagName == 'H6'))
                let isParentHeader = (hasText && (parentTagName == 'H1' || parentTagName == 'H2' || parentTagName == 'H3' || parentTagName == 'H4' || parentTagName == 'H5' || parentTagName == 'H6'))
                return isHeader || isParentHeader
            } catch (e) {
                return false
            }
        }
        isCode(data){
            try {
                let tagName = data.tagName
                return (tagName == 'PRE' || tagName == 'CODE')
            } catch (e) {
                return false
            }
        }
        isQuote(data){
            try {
                let tagName = data.tagName
                return (tagName == 'BLOCKQUOTE')
            } catch (e) {
                return false
            }
        }
        isImage(data){
            try{
                // todo: check if SVG or IMG
                let tagName = data.tagName
                let el = data.el
                if (tagName == 'IMG' || (tagName == 'SVG' && this.bbox.height * this.bbox.width > 800))
                    return true
                else {
                    let isBackgroundImage = (window.getComputedStyle(el).backgroundImage.slice(0,3) == 'url')
                    if (isBackgroundImage){
                        let url = window.getComputedStyle(el).backgroundImage.slice(4, -1).replace(/"/g, "")
                        let filetype = url.split('.').pop()
                        if (['jpg', 'png', 'gif', 'jpeg', 'webp'].includes(filetype))
                            return true
                    }
                    return false
                }

            } catch (e) {
                return false
            }
        }
        isIcon(data){
            try {
                let tagName = data.tagName
                let el = data.el
                let isSVG = (tagName == 'SVG')
                let isSmall = (this.bbox.height * this.bbox.width < 800)
                let isKBD = (tagName == 'KBD')

                if (isKBD || isSVG && isSmall){
                    return true
                }
                else {
                    let isBackgroundImage = (window.getComputedStyle(el).backgroundImage.slice(0,3) == 'url')
                    if (isBackgroundImage){
                        let url = window.getComputedStyle(el).backgroundImage.slice(4, -1).replace(/"/g, "")
                        let filetype = url.split('.').pop()
                        if (filetype == 'svg' || filetype.startsWith('data'))
                            return true
                    }
                    else return false
                }
            } catch (e) {
                return false
            }
        }
        isList(data){
            try {
                let tagName = data.tagName
                return (tagName == 'TABLE' || tagName == 'UL' || tagName == 'OL'|| tagName == 'DL')
            } catch (e) {
                return false
            }
        }
        getDescription(el){
            try {
                if (el.getAttribute('aria-label'))
                    return el.getAttribute('aria-label')
                if (el.getAttribute('alt'))
                    return el.getAttribute('alt')
                if (el.getAttribute('role'))
                    return el.getAttribute('role')
                return ''
            } catch (e) {
                return ''
            }
        }
        getText(el){
            try {
                let text = el.innerText ? el.innerText: ''
                let type = el.getAttribute('type')
                
                // remove any newlines
                text = text.replace(/\n/g, ' ')
                // remove any extra whitespace
                text = text.replace(/\s+/g, ' ')
                // remove any leading or trailing whitespace
                text = text.trim()

                // if the element is a button, use the button text
                if (text == '') {
                    if (
                        el.tagName.toUpperCase() == 'INPUT' && 
                        type && type.toUpperCase() == 'SUBMIT' &&
                        el.getAttribute('value')
                    ) text = el.getAttribute('value')
                }
                if(!text) return ""
                return text
            } catch (e) {
                return ''
            }
        }
        getInputType(el){
            try {
                let type = ''
                if (el.tagName.toUpperCase() == 'INPUT') {
                    type = el.getAttribute('type')
                }

                return type
            } catch (e) {
                return ''
            }
        }
        getSelectOptions(el){
            try {
                let options = []
                el.querySelectorAll('option').forEach((option, index) => {
                    let op = { value: option.value, text: option.text }
                    options.push(op)
                })
                return options
            } catch (e) {
                return []
            }
        }
        serialize(){
            // TODO: fix from the logicrite side
            // remove $ because they ruin the logicrite inputs 
            var className = this.el.className.toString();
            var idName = this.el.id.toString();
            var text = this.text.toString();

            // Position of the element
           /*  let x = ( this.isIFrame ? this.bbox.x + this.iframePosition.x : this.bbox.x )
            let y = ( this.isIFrame ? this.bbox.y + this.iframePosition.y : this.bbox.y )
            if(this.scrollContainer){
                // Adjust x,y relative to scrollbar position
                x += this.scrollContainer.scrollLeft
                y += this.scrollContainer.scrollTop
            } */

            let x = 0;
            let y = 0;
            try {

                const rect = this.el.getBoundingClientRect();
                x = rect.left;
                y = rect.top;
                
                // If in an iframe
                if (this.isIFrame) {
                    const iframeRect = (this as any).iframe.getBoundingClientRect();
                    x += iframeRect.left;
                    y += iframeRect.top;
                }

            } catch(e){

                x = ( this.isIFrame ? this.bbox.x + this.iframePosition.x : this.bbox.x )
                y = ( this.isIFrame ? this.bbox.y + this.iframePosition.y : this.bbox.y )
                if(this.scrollContainer){
                    // Adjust x,y relative to scrollbar position
                    x += this.scrollContainer.scrollLeft
                    y += this.scrollContainer.scrollTop
                }

            }

            let data = {
                'id': idName,
                'class': className,
                'index': this.index,
                'tagName': this.tagName,
                'x': x,
                'y': y,
                'width': this.bbox.width,
                'height': this.bbox.height,
                'text': text,
                'interactivity': [this.isElmClickable? 'clickable' : 'non-clickable', this.isTriggerable? 'trigger' : 'non-trigger'],
                'inputType': this.inputType,
                'isIframe': this.isIFrame,
                'iframePosition': this.iframePosition,
            }

            let isButton = this.isButton({
                'tagName': this.el.tagName.toUpperCase(),
                'classlist': this.el.classList,
                'el': this.el
            })
            
            if(isButton) data['tagName'] = "BUTTON"
            if(this.tagName == 'SELECT') data['options'] = this.getSelectOptions(this.el)
            if(this.tagName == 'INPUT'){
                if (this.el.getAttribute('placeholder') != null) {
                    data['placeholder'] = this.el.getAttribute('placeholder').replace(/\$/g, '');
                }

                if(this.el.hasAttribute("src")){
                    data['src'] = this.el.getAttribute('src')
                }
                if (this.el.value !== undefined) {
                    data['value'] = this.el.value;
                }
            }
            if(this.tagName == 'IMG') data['src'] = this.el.getAttribute('src')
            // if href exist , add it 
            if(this.tagName == 'A' && this.el.getAttribute('href')) data['href'] = this.el.getAttribute('href')

            return data
        }
    }

    enum NodeTypes {
        ELEMENT_NODE                = 1,
        ATTRIBUTE_NODE              = 2,
        TEXT_NODE                   = 3,
        CDATA_SECTION_NODE          = 4,
        ENTITY_REFERENCE_NODE       = 5,
        ENTITY_NODE                 = 6,
        PROCESSING_INSTRUCTION_NODE = 7,
        COMMENT_NODE                = 8,
        DOCUMENT_NODE               = 9,
        DOCUMENT_TYPE_NODE          = 10,
        DOCUMENT_FRAGMENT_NODE      = 11,
        NOTATION_NODE               = 12
    }
    
    const textTags = [
        "A", 
        "abbr", 
        "acronym", 
        "address", 
        "area", 
        "aside", 
        "b", 
        "base", 
        "basefont", 
        "bdi",
        "bdo", 
        "big", 
        "br", 
        "caption", 
        "cite", 
        "col" , 
        "colgroup", 
        "dd", 
        "del", 
        'dfn', 
        "dt", 
        "dir", 
        "em",
        "embed", 
        "figcaption", 
        "font", "h1", "h2", "h3", "head", "hr", "i", "img", "ins", "kbd", "svg",
        "keygen", "legend", "li", 'link', "mark", "menuitem", "meta", "meter", "h4", "h5", "h6",
        "noframes", "noscript", "optgroup", "option", "output", "p", "param", "pre", "q",
        "rp", "rt", "s", "samp", "script", "small", "source", "span", "strike", "strong", "style",
        "sub", "summary", "sup", "tfoot", "th", "thead", "time", "title", "track", "tt", "u", "var",
        "video", "wbr"
    ]

    const blockTags = [
        "applet", 
        "article", 
        "audio", 
        "body",
        // "button", 
        "canvas", 
        "center", 
        "code",
        "datalist", 
        "div", 
        "dl", 
        "fieldset",
        "figure", 
        "footer", 
        "form", 
        "frame",
        "frameset", 
        "header", 
        "html",
        "iframe", 
        "section", 
        "select", 
        "table",
        "tbody", 
        "textarea", 
        "ul", 
        "etc"
    ]

    const interactiveTags = [
        "A", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "RADIO", "CHECKBOX", "SPAN", "LABEL"
    ]

    function containsBlockTag(node: HTMLElement) : boolean{
        // Loop through all children
        for (let i = 0; i < node.childNodes.length; i++) {
            let child = node.childNodes[i]
            if (NodeTypes[child.nodeType] === NodeTypes[NodeTypes.ELEMENT_NODE]) {
                let childElement: HTMLElement = child as HTMLElement
                if (blockTags.includes(childElement.tagName.toLowerCase())) {
                    return true
                }
            }
        }
        return false
    }


    function checkIfPointOnPageIsElementIframe(elmOnPage: Element, nodeElement: HTMLElement) {

        var validElement = false;

        let _bbox = nodeElement.getBoundingClientRect();
        if (elmOnPage && elmOnPage.tagName === "IFRAME") {
            // Assert elmOnPage as HTMLIFrameElement to access contentDocument
            let iframeElm = elmOnPage as HTMLIFrameElement;
            try {
                // Attempt to access the iframe's document
                let iframeDoc = iframeElm.contentDocument || iframeElm.contentWindow?.document;
                if (iframeDoc) {
                    // Adjust coordinates to the iframe's context
                    let relativeX = (_bbox.x + _bbox.width / 2) - iframeElm.getBoundingClientRect().left;
                    let relativeY = (_bbox.y + _bbox.height / 2) - iframeElm.getBoundingClientRect().top;

                    // Check visibility within the iframe
                    let innerElmOnPage = iframeDoc.elementFromPoint(relativeX, relativeY);
                    if (innerElmOnPage === nodeElement || nodeElement.contains(innerElmOnPage)) {
                        return true;
                    }
                }
            } catch (e) {
                console.error("Error accessing iframe contents:", e);
                return false;
            }
        }

        return validElement;
    }
    



    function checkElementOnPoint(nodeElement) {
        let _bbox = nodeElement.getBoundingClientRect();

        // Function to calculate points 25% away from each corner
        function getCornerPoints() {
            return [
                // { x: _bbox.left + _bbox.width * 0.5, y: _bbox.top + _bbox.height * 0.5 },
                { x: _bbox.left + _bbox.width * 0.25, y: _bbox.top + _bbox.height * 0.25 }, // Top-left corner
                // { x: _bbox.left + _bbox.width * 0.75, y: _bbox.top + _bbox.height * 0.25 }, // Top-right corner
                // { x: _bbox.left + _bbox.width * 0.25, y: _bbox.top + _bbox.height * 0.75 }, // Bottom-left corner
                { x: _bbox.left + _bbox.width * 0.75, y: _bbox.top + _bbox.height * 0.75 }  // Bottom-right corner
            ];
        }

        let points = getCornerPoints(); // Get points from each corner, 25% inward

        // Check each point to see if it corresponds to the original nodeElement, its parent, or matching text
        for (let point of points) {
            let elementAtPoint = nodeElement.getRootNode().elementFromPoint(point.x, point.y);

            if (elementAtPoint === nodeElement ||
                elementAtPoint === nodeElement.parentElement ||
                (elementAtPoint instanceof HTMLElement && elementAtPoint.innerText === nodeElement.innerText)) {
                return true; // If any point matches, return true immediately
            }
        }

        return false; // If no points match, return false
    }

    function checkIfHrefIsLink(nodeElement) {

        if (nodeElement.href) {
            if (nodeElement.href.startsWith('https://')
                ||
                nodeElement.href.startsWith('http://')
                ||
                nodeElement.href.startsWith('/')
                ||
                nodeElement.href.includes('.')
                ||
                (
                    nodeElement.href.startsWith('#')
                    &&
                    window.getComputedStyle(nodeElement).cursor === 'pointer'
                )) {
                return true;
            }
        }
        return false;

    }


    function isElementVisible(element) {
        if (!element) {
            return false; // No element provided
        }

        const style = window.getComputedStyle(element);

        // Check for display property
        if (style.display === 'none') {
            return false; // Element is not displayed
        }

        // Check for visibility property
        if (style.visibility === 'hidden') {
            return false; // Element is hidden
        }

        // Check for opacity property
        if (parseFloat(style.opacity) === 0) {
            return false; // Element is fully transparent
        }

        // Check if the element's dimensions are 0
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return false; // Element has no dimensions
        }

        // Check if the element is off the viewport
        if (rect.top + rect.height < 0 || rect.left + rect.width < 0 ||
            rect.bottom - rect.height > (window.innerHeight || document.documentElement.clientHeight) ||
            rect.right - rect.width > (window.innerWidth || document.documentElement.clientWidth)) {
            return false; // Element is off the viewport
        }

        return true; // If all checks pass, the element is visible
    }


    function getDirectTextContent(element) {
        // Clone the element
        const clone = element.cloneNode(true);

        // Remove all child elements from the clone
        Array.from(clone.childNodes).forEach(node => {
            if ((node as Node).nodeType === Node.ELEMENT_NODE) { // Check if the node is an element node
                clone.removeChild(node);
            }
        });

        // The textContent of the clone now contains only the direct text of the original element
        return clone.textContent.trim();
    }

    // remove the class stretched-link from all elements
    document.querySelectorAll('.stretched-link').forEach((el) => {
        el.classList.remove('stretched-link');
    });


    var elementsToAddInTheEnd = [];
    var elementsToAddInTheEndOriginalPointerEvents = [];


    // get all the anchor elements that have 0 children
    document.querySelectorAll('a').forEach((el) => {

        var skip = false;

        
        /* if(!isWithinViewport(el)){
            skip = true;
        } */

        if (el.getBoundingClientRect().y == 0 && el.getBoundingClientRect().x == 0) {
            skip = true;
        }
        


        if (skip) {

        }
        else {
            console.log('not skipping', el.getBoundingClientRect().y, window.innerHeight);

            var invisibleChildren = true;
            // check if none of its children are visible
            if (el.childElementCount > 0) {
                for (let i = 0; i < el.children.length; i++) {
                    if (isElementVisible(el.children[i])) {
                        // if any of the children is visible, set to false
                        invisibleChildren = false;
                    }
                }
            }

            if ((el.childElementCount == 0 || invisibleChildren)) {
                if (getDirectTextContent(el) == '') {
                    // check if the element has a href attribute

                    // check if id is xxx


                    if (el.getAttribute('href')) {
                        if (checkIfHrefIsLink(el)) {
                            // this is probably a cover link that covers important elements, set pointer events to zero
                            if (checkElementOnPoint(el)) {

                                if (isElementVisible(el)) {
                                    
                                    elementsToAddInTheEnd.push(el);
                                    elementsToAddInTheEndOriginalPointerEvents.push(el.style.pointerEvents);
                                }

                                try{
                                    el.style.pointerEvents = 'none';
                                } catch (e) {}
                            }
                        }

                    }
                }
            }
        }
    });


    try{
        // EDGE CASE: sometimes the opacity of the body is 0, if so set it to 1
        if (document.body.style.opacity == '0') {
            document.body.style.opacity = '1';
        }
    } catch(e){}



    //let captured : Segment[] = []
    // Traverse the DOM tree
    let domNodes: Node[] = [document.body]
    let capturedElms: HTMLElement[] = []
    let m : HTMLElement[] = []
    let p:any = []

    let _i = 0;
    while (domNodes.length > 0) {
        let node: Node = domNodes.shift()

        _i++;
        if(_i > 100000){
            console.log("BREAKING after MANY iterations");
            break;
        }

        // Process the node
        if (
            (NodeTypes[node.nodeType] === NodeTypes[NodeTypes.ELEMENT_NODE])
        ){
            let nodeElement: HTMLElement = node as HTMLElement


            // if(!isWithinViewport(nodeElement)){
            //     continue
            // }

            // IframeHandling
            let isIFrame = false
            let iframePositions = {x:0, y:0}
            // Element is in not Iframe but it is part iframe
            if(nodeElement.ownerDocument !== document) {
                isIFrame=true

                // get position of iframe owner
                let iframeRect = nodeElement.ownerDocument.defaultView.frameElement.getBoundingClientRect()
                iframePositions = { x:iframeRect.x, y:iframeRect.y }
            }
            if (nodeElement instanceof HTMLIFrameElement){
                try{
                    let iframeDoc = nodeElement.contentDocument || nodeElement.contentWindow.document
                    let iframeRect = nodeElement.getBoundingClientRect()

                    //Get x and y 
                    let adjustedX = iframeRect.x - iframeRect.left
                    let adjustedY = iframeRect.y - iframeRect.top

                    nodeElement = iframeDoc.elementFromPoint(adjustedX, adjustedY) as HTMLElement

                    

                    if (nodeElement == null) {

                        console.log('nodeElement is null');
                        continue // if the element is null, skip it

                    }
                    
                    domNodes.push(...nodeElement.childNodes)
                    continue

                    

                } catch (e) { 
                    console.log('Error in iframe handling', e)
                    continue
                }
            }

            // if node is a script, noscript, or style tag, skip it
            if (
                (nodeElement.tagName === "SCRIPT") ||
                (nodeElement.tagName === "NOSCRIPT") || 
                (nodeElement.tagName === "STYLE")
            ) {
                continue
            }
            
            // if node has no children and either its width or height is 0, skip it 
            if (
                (nodeElement.childNodes.length === 0) &&
                ((nodeElement.offsetWidth === 0) || (nodeElement.offsetHeight === 0)
                && !nodeElement.shadowRoot)
            ) {
                continue
            }

            // if node is less than 10 pixels in width or height, skip it
            if (
                (nodeElement.offsetWidth <= 10) || (nodeElement.offsetHeight <= 10)
            ) {
                domNodes.push(...node.childNodes)

                if (nodeElement.shadowRoot) {
                    let shadowRootChildren = nodeElement.shadowRoot.childNodes
                    for (let i = 0; i < shadowRootChildren.length; i++) {
                        domNodes.push(shadowRootChildren[i])
                    }
                }

                continue
            }
            
            // if node is hidden, skip it
            let computedStyle = window.getComputedStyle(nodeElement)
            if (computedStyle.display === 'none' ||
                computedStyle.visibility === 'hidden' 
                    // || parseFloat(computedStyle.opacity) === 0
                ) 
            {

                continue;
            }

            // if tag is puppeteer-mouse-pointe, skip it 
            if (
                (nodeElement.tagName === "PUPPETEER-MOUSE-POINTER")
            ) {
                continue
            }

            // if SVG, no need to traverse children

            if (nodeElement.tagName.toUpperCase() === "SVG" || nodeElement.tagName.toUpperCase() === "IMG") {
                // Get the bounding box of the element
                let _bbox = nodeElement.getBoundingClientRect();
                // Find the element at the center point of nodeElement
                // let elmOnPage = document.elementFromPoint(_bbox.x + _bbox.width / 2, _bbox.y + _bbox.height / 2);

                let elmOnPage = (nodeElement.getRootNode() as Document).elementFromPoint(_bbox.x + _bbox.width / 2, _bbox.y + _bbox.height / 2); 

                
                // check if elmOnPage is nodeElement's direct parent and has the same size
                if (elmOnPage === nodeElement.parentElement && (nodeElement as HTMLElement).offsetWidth === nodeElement.offsetWidth && (nodeElement as HTMLElement).offsetHeight === nodeElement.offsetHeight) {
                    capturedElms.push(nodeElement);
                    continue;
                }


                // Check if elmOnPage is nodeElement or a descendant of nodeElement
                if (
                    (elmOnPage === nodeElement || nodeElement.contains(elmOnPage))
                    ||
                    checkIfPointOnPageIsElementIframe(elmOnPage, nodeElement)    
                ) {
                    
                    // If elmOnPage is nodeElement or its descendant, add nodeElement to capturedElms
                    capturedElms.push(nodeElement);
                    continue;
                }

                
                continue;
            }

            // Handle shadow root
            if (nodeElement.shadowRoot) {
                let shadowRootChildren = nodeElement.shadowRoot.childNodes
                for (let i = 0; i < shadowRootChildren.length; i++) {
                    domNodes.push(shadowRootChildren[i])

                    // also add childred, sometimes they will have both
                    domNodes.push(...node.childNodes)
                }
                continue
            }




            // EDGE CASES

            // if DIV and class has DraftEditor-root (FOR SPECIFIC TYPES OF EDITORS)
            if (nodeElement.tagName.toUpperCase() === "DIV" && nodeElement.classList.contains('DraftEditor-root')) {

                let _bbox = nodeElement.getBoundingClientRect();
                let elmOnPage = (nodeElement.getRootNode() as Document).elementFromPoint(_bbox.x + _bbox.width / 2, _bbox.y + _bbox.height / 2); 


                if (elmOnPage === nodeElement || nodeElement.contains(elmOnPage)) {
                    capturedElms.push(nodeElement);
                    continue;
                }

            }




            // check if any subnode is a block tag
            let isBlockTag = blockTags.includes(nodeElement.tagName.toLowerCase())
            let isTextTag = textTags.includes(nodeElement.tagName.toLowerCase())
            let hasBlockTag = containsBlockTag(nodeElement)
        
            if (isBlockTag && hasBlockTag) {
                // Skip this node further
                domNodes.push(...node.childNodes)
                continue
            } else if(isTextTag) {

                // should only contain text node inside it 
                if(nodeElement.innerText !== "" && nodeElement.childNodes.length == 1) {


                   if (nodeElement.childNodes[0] instanceof Text) {

                        if (checkElementOnPoint(nodeElement)) {
                            capturedElms.push(nodeElement);
                            continue;
                        }

                        /* let _bbox = nodeElement.getBoundingClientRect()
                        let center = { 
                            x: _bbox.x + _bbox.width / 2, 
                            y: _bbox.y + _bbox.height / 2
                        }

                        // Check if node is self or if parent
                       let centerElm = (nodeElement.getRootNode() as Document).elementFromPoint(center.x, center.y);

                        if (
                            centerElm === nodeElement ||
                            (nodeElement.parentElement && nodeElement.parentElement === centerElm) ||
                            (centerElm instanceof HTMLElement && centerElm.innerText === nodeElement.innerText)
                        ) {
                            capturedElms.push(nodeElement);
                            continue;
                        } */
                   }

                }else if (nodeElement.innerText.trim() !== "") {
                    let hasTextNode = false;

                    // Check for non-empty text nodes among child nodes
                    for (let i = 0; i < nodeElement.childNodes.length; i++) {
                        let isLabel = false;
                        try{
                            const childNode = nodeElement.childNodes[i] as HTMLElement;
                            if(childNode.tagName && childNode.tagName.toLowerCase() === 'label') {
                                isLabel = true;
                            }
                        } catch(e) {

                        }
                        if (nodeElement.childNodes[i].nodeType === Node.TEXT_NODE || isLabel) {
                            if (nodeElement.childNodes[i].textContent.trim() === "") continue;
                            else {
                                hasTextNode = true;
                                break;
                            }
                        }
                    }


                    // If a non-empty text node is found, perform a visibility check
                    if (hasTextNode) {
                        let _bbox = nodeElement.getBoundingClientRect();
                        let centerX = _bbox.left + _bbox.width / 2;
                        let centerY = _bbox.top + _bbox.height / 2;

                        let elmOnPage = (nodeElement.getRootNode() as Document).elementFromPoint(centerX, centerY);


                        // Check if elmOnPage is nodeElement or a descendant of nodeElement
                        if (elmOnPage === nodeElement || nodeElement.contains(elmOnPage) || elmOnPage === nodeElement.parentElement) {
                            capturedElms.push(nodeElement); // Element is visible and contains text
                            domNodes.push(...nodeElement.childNodes); // Continue to process child nodes

                            continue
                        }
                    }
                }




                if (nodeElement.tagName.toUpperCase() === "SPAN" || nodeElement.tagName.toUpperCase() === "I") {


                    // check if icon is a subset of any of the class names
                    var iconBool = false
                    const iconClasses = [
                        'icon', 'fa', 'fas', 'far', 'fal', 'fad', 'fab',
                        'bi', 'glyphicon', 'material-icons', 'md', 'ion',
                        'ionicons', 'icon-', 'feather', 'ti', 'la', 'fi',
                        'wi', 'typcn', 'entypo-'
                    ];
                    for (let i = 0; i < nodeElement.classList.length; i++) {
                        if (
                            nodeElement.classList[i].includes('icon') ||
                            iconClasses.includes(nodeElement.classList[i])
                        ) {
                            iconBool = true
                        }
                    }


                    if (window.getComputedStyle(nodeElement).cursor == 'pointer') {
                        // check if width and height is less than 40
                        if (nodeElement.offsetWidth < 40 && nodeElement.offsetWidth > 15) {
                            if (nodeElement.offsetWidth == nodeElement.offsetHeight) {
                                iconBool = true
                            }
                        }
                    }


                    if (iconBool) {

                        var _bbox = nodeElement.getBoundingClientRect()

                        let elmOnPage = (nodeElement.getRootNode() as Document).elementFromPoint(_bbox.x + _bbox.width / 2, _bbox.y + _bbox.height / 2)
                        if ((elmOnPage === nodeElement || nodeElement.contains(elmOnPage))
                            ||
                            checkIfPointOnPageIsElementIframe(elmOnPage, nodeElement)) {
                            // If elmOnPage is nodeElement or its descendant, add nodeElement to capturedElms
                            capturedElms.push(nodeElement);
                            continue;
                        }

                    }
                }




                domNodes.push(...node.childNodes)
                continue



            } else {

                
                // Five points check
                let _bbox = nodeElement.getBoundingClientRect()






                // if element is an anchor tag, and has an href that points to an https:// 
                if (nodeElement.tagName.toUpperCase() === "A" && (nodeElement as HTMLAnchorElement).href &&
                    checkIfHrefIsLink(nodeElement)
                ) {


                    let elmOnPage = (nodeElement.getRootNode() as Document).elementFromPoint(_bbox.x + _bbox.width / 2, _bbox.y + _bbox.height / 2)


                    if ((
                        elmOnPage === nodeElement ||
                        nodeElement.contains(elmOnPage) ||

                        // OR elmOnPage is the direct parent of nodeElement and has the same text
                        (elmOnPage === nodeElement.parentElement)
                    )
                        ||
                        checkIfPointOnPageIsElementIframe(elmOnPage, nodeElement)) {
                        // If elmOnPage is nodeElement or its descendant, add nodeElement to capturedElms

                        capturedElms.push(nodeElement);
                        
                        if (nodeElement.childNodes.length > 1) {
                            domNodes.push(...node.childNodes);
                        }

                        continue;
                    }
                }



                // if button, check if the center element is the same as the button or one of its children
                // some buttons have spans and icons etc inside, and sometimes in multiple layers
                if (nodeElement.tagName.toUpperCase() === "BUTTON") {
                    let elmOnPage = (nodeElement.getRootNode() as Document).elementFromPoint(_bbox.x + _bbox.width / 2, _bbox.y + _bbox.height / 2)

                    if (elmOnPage === nodeElement || nodeElement.contains(elmOnPage)) {

                        capturedElms.push(nodeElement);
                        continue;
                    }
                }



                // check if element is SELECT
                if (nodeElement.tagName.toUpperCase() === "SELECT") {
                    let elmOnPage = (nodeElement.getRootNode() as Document).elementFromPoint(_bbox.x + _bbox.width / 2, _bbox.y + _bbox.height / 2)


                    if (elmOnPage === nodeElement || nodeElement.contains(elmOnPage)) {
                        // If elmOnPage is nodeElement or its descendant, add nodeElement to capturedElms
                        capturedElms.push(nodeElement);
                        continue;
                    }

                }



                let topLeft = { x: _bbox.x, y: _bbox.y }
                let topRight = { x: _bbox.x + _bbox.width - 1, y: _bbox.y }
                let bottomLeft = { x: _bbox.x, y: _bbox.y + _bbox.height - 1 }
                let BottomRight = { x: _bbox.x + _bbox.width - 1, y: _bbox.y + _bbox.height - 1 }
                let Center = { x: _bbox.x + _bbox.width / 2, y: _bbox.y + _bbox.height / 2 }

                // Get Elm at each point
                /* let topLeftElm = document.elementFromPoint(topLeft.x, topLeft.y)
                let topRightElm =  document.elementFromPoint(topRight.x, topRight.y)
                let bottomLeftElm = document.elementFromPoint(bottomLeft.x, bottomLeft.y)
                let bottomRightElm = document.elementFromPoint(BottomRight.x, BottomRight.y)
                let centerElm = document.elementFromPoint(Center.x, Center.y) */

                let topLeftElm = (nodeElement.getRootNode() as Document).elementFromPoint(topLeft.x, topLeft.y);
                let topRightElm = (nodeElement.getRootNode() as Document).elementFromPoint(topRight.x, topRight.y);
                let bottomLeftElm = (nodeElement.getRootNode() as Document).elementFromPoint(bottomLeft.x, bottomLeft.y);
                let bottomRightElm = (nodeElement.getRootNode() as Document).elementFromPoint(BottomRight.x, BottomRight.y);
                let centerElm = (nodeElement.getRootNode() as Document).elementFromPoint(Center.x, Center.y);

                let numOfMatches = (
                    (topLeftElm === nodeElement ? 1 : 0) + 
                    (topRightElm === nodeElement ? 1 : 0) + 
                    (bottomLeftElm === nodeElement ? 1 : 0) + 
                    (bottomRightElm === nodeElement ? 1 : 0) + 
                    (centerElm === nodeElement ? 1 : 0) 
                )

                if ( numOfMatches==5 ){
                    if( nodeElement.childNodes.length > 0 ) {
                        domNodes.push(...node.childNodes)

                        // check if it has text 
                        if (nodeElement.innerText.trim() === "") continue
                    }

                    // check if node is a ul
                    if (nodeElement.tagName.toUpperCase() === "UL") {
                        continue;
                    }
                    
                    capturedElms.push(nodeElement)
                    continue
                } else if ( numOfMatches >= 3 ){                    
                    if (interactiveTags.includes(nodeElement.tagName.toUpperCase())) {

                        if (nodeElement.childNodes.length > 0) {
                            domNodes.push(...node.childNodes)
                        }

                        capturedElms.push(nodeElement)
                        continue
                    }

                   domNodes.push(...node.childNodes)
                   continue
                }
                else {
                    if (nodeElement.childNodes.length > 1) {
                        domNodes.push(...node.childNodes)
                        continue
                    } else {
                        if (interactiveTags.includes(nodeElement.tagName.toUpperCase())) {
                            if (nodeElement.tagName.toUpperCase() === "A" && nodeElement.childNodes.length > 0) {
                                // TODO - investigate further
                                domNodes.push(...node.childNodes)
                                continue
                            }

                            // get mouse cursor style
                            // capturedElms.push(nodeElement)
                            // continue

                            // check if the point is inside the element
                            let _bbox = nodeElement.getBoundingClientRect()
                            let center = { x: _bbox.x + _bbox.width / 2, y: _bbox.y + _bbox.height / 2 }
                            let centerElm = (nodeElement.getRootNode() as Document).elementFromPoint(center.x, center.y)
                            if (centerElm === nodeElement || nodeElement.contains(centerElm)) {
                                capturedElms.push(nodeElement)
                                continue
                            }

                            // domNodes.push(...node.childNodes)
                            // continue
                            

                        } else {
                            domNodes.push(...node.childNodes)
                            continue
                        }
                    }
                }
            }
        } else if (NodeTypes[node.nodeType] === NodeTypes[NodeTypes.TEXT_NODE]) {
            let nodeTex: Text = node as Text

            // If the text is empty, skip it
            if (nodeTex.textContent.trim() === '') {
                continue
            } else {
                let parent = nodeTex.parentElement
                if (parent === null) {
                    continue
                } else {
                    let _bbox = parent.getBoundingClientRect()
                    let center = { x: _bbox.x + _bbox.width / 2, y: _bbox.y + _bbox.height / 2 }
                    let centerElm = (parent.getRootNode() as Document).elementFromPoint(center.x, center.y)
                    if(centerElm === parent) {
                        // check if already exist in capturedElms
                        if(capturedElms.includes(parent)) continue
                        else if(parent.parentElement && capturedElms.includes(parent.parentElement)) continue
                        else capturedElms.push(parent)
                    }
                }
            }
        } else {
            // Skip this node, not of interest
            continue
        }   
    }


    console.log('capturedElms', capturedElms.length)
    console.log('capturedElms', capturedElms)


    for(let i = 0; i < elementsToAddInTheEnd.length; i++){
        elementsToAddInTheEnd[i].style.pointerEvents = elementsToAddInTheEndOriginalPointerEvents[i]
    }

    capturedElms = capturedElms.concat(elementsToAddInTheEnd);













    // go through all elements and group the ones that have the exact following properties:
    // - same id (if it has an id)
    // - same x,y,width,height (rounded to the nearest pixel)
    // - same text (if it has text)
    // - same image (if it has an image)
    // - same link (if it has a link)
    // - same class (if it has a class)
    // - same tag name (if it has a tag name)

    // for each group that has 3 or more elements, i want you to prepend their parent and parent's parent id and class (separated by dots) and id (separated by hash) to each of the elements



    function roundRect(rect) {
        return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    }
    
    function getImageSrc(el) {
        if (el.tagName.toLowerCase() === 'img') {
            return el.src;
        }
        const bg = window.getComputedStyle(el).backgroundImage;
        const match = bg.match(/url\("(.*?)"\)/);
        return match ? match[1] : '';
    }
    
    function getLinkHref(el) {
        return el.closest('a')?.href || '';
    }
    
    function getText(el) {
        return el.textContent.trim();
    }
    
    function getIdentifier(el) {
        const rect = roundRect(el.getBoundingClientRect());
        return JSON.stringify({
            id: el.id || '',
            // rect,
            text: getText(el),
            image: getImageSrc(el),
            link: getLinkHref(el),
            className: el.className || '',
            tagName: el.tagName.toLowerCase()
        });
    }
    
    function getAncestryData(el) {
        const parents = [];
        let parent = el.parentElement;
        for (let i = 0; i < 2; i++) {
            if (!parent) {
                parents.push({ id: '', className: '', tag: 'div' });
                continue;
            }
            parents.push({
                id: parent.id || parent.tagName.toLowerCase(),
                className: parent.className?.replace(/\s+/g, '.') || parent.tagName.toLowerCase()
            });
            parent = parent.parentElement;
        }
        return parents.reverse(); // grandparent first
    }
      
  function updateIdAndClass(el, ancestry) {
    try{
        const className = el.className || el.getAttribute('class') || '';
        const childId = el.id || el.tagName.toLowerCase();
        const childClass = className.replace(/\s+/g, '.') || el.tagName.toLowerCase();

      // ID path: always include 3 segments
      const idPath = [...ancestry.map(a => a.id || a.tag || 'div'), childId].join('_');
      el.tasker_id = idPath;
    //   el.setAttribute('tasker_id', idPath);

      // Class path: always include 3 segments
      const classPath = [...ancestry.map(a => a.className || a.tag || 'div'), childClass].join('_');
      el.tasker_class = classPath;
    //   el.setAttribute('tasker_class', classPath);
    } catch(e){
        console.log("error updating id and class", e)
    }
  }


    try{
    
        // Main logic
        const groups = {};
        capturedElms.forEach(el => {
            const key = getIdentifier(el);
            if (!groups[key]) groups[key] = [];
            groups[key].push(el);
        });

        
        Object.values(groups).forEach((group: HTMLElement[]) => {
            if (group.length >= 2) {
                group.forEach((el: HTMLElement) => {
                    const ancestry = getAncestryData(el);
                    updateIdAndClass(el, ancestry);
                });
                // console.log("group", group)
            }
        });

    } catch(e){
        console.log("error updating id and class", e)
    }











    // Sort the segments by y position
    let segments = []

    // Get ALL Scrollable elements
    const scrollableInnerElements : HTMLElement[] = []
    document.querySelectorAll('*').forEach(function(element) {
        const htmlElement = element as HTMLElement;
        if (getScrollContainerProperties(htmlElement)) {
            scrollableInnerElements.push(htmlElement);
        }
    });
    
    console.log('scrollableInnerElements', scrollableInnerElements)

    for (let i = 0; i < capturedElms.length; i++) {
        let bboxElm = capturedElms[i].getBoundingClientRect()
        let include = true
        if(bbox){
            // console.log('bboxElm', bboxElm.y)
            if(
                // Check if the element is outside the bounding box
                bboxElm.x < bbox.x || bboxElm.x + bboxElm.width > bbox.x + bbox.width || 
                bboxElm.y < bbox.y || bboxElm.y + bboxElm.height > bbox.y + bbox.height
            ) {
                include = false;
                console.log('dont include', bboxElm.y)
            } else {

            }
        }

        if(include){
            let parentScrollContainer=null;
            for (const scrollContainer of scrollableInnerElements) {
                if(isDistantParent(scrollContainer, capturedElms[i])){
                    parentScrollContainer = scrollContainer;
                    break;
                }
            }

            // If the element is a child of a scrollable container
            // We need to adjust its position to be relative to the scrollable container relative to the viewport
            segments.push(
                new ELM(
                    capturedElms[i], 
                    i, 
                    false, 
                    { x: 0, y: 0 },
                    parentScrollContainer
                ).serialize()
            )
            console.log("elm", capturedElms[i], new ELM(
                capturedElms[i], 
                i, 
                false, 
                { x: 0, y: 0 },
                parentScrollContainer
            ).serialize())
        }


            // if the last added element has a tasker_id, then replace the id with the tasker_id
            if ((capturedElms[i] as any).tasker_id) {
                segments[segments.length - 1].id = (capturedElms[i] as any).tasker_id;
            }
            // if the last added element has a tasker_class, then replace the class with the tasker_class
            if ((capturedElms[i] as any).tasker_class) {
                segments[segments.length - 1].class = (capturedElms[i] as any).tasker_class;
            }
        
    }

    console.log('segments', segments);
    console.log('scrollableInnerElements', scrollableInnerElements);
    if(newReturn){

        console.log("NEW RETURN segments")

        let index = 0
        const scrollElms = []
        for (const scrollContainer of scrollableInnerElements) {
            scrollElms.push(
                new ELM(
                    scrollContainer, 
                    index, 
                    false, 
                    { x: 0, y: 0 },
                    null
                ).serialize()
            )
            index++
        }

        return [
            segments,
            scrollElms
        ]
    }

    return segments
}