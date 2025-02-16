export async function findRepeatedXpath(
    elms: { x: number, y: number, tagName: string }[]
) {
    function getXPath(element) {
        // Initialize empty path
        var path = '';

        // Loop through the element's ancestors
        for (; element && element.nodeType == 1; element = element.parentNode) {
            var tagName = element.tagName.toLowerCase();
            var index = 1;

            // If the element has siblings with the same tag name, determine its position
            for (var sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                if (sibling.nodeType == 1 && sibling.tagName.toLowerCase() == tagName) {
                    index++;
                }
            }

            // Construct the XPath for this element with the position
            var step = tagName + '[' + index + ']';
            path = '/' + step + path;
        }

        // Return the full XPath
        return path;
    }


    function getCommonXPathTemplate(element1, element2) {

        var xpath1 = getXPath(element1);
        var xpath2 = getXPath(element2);

        console.log("Xpath1", xpath1)
        console.log("Xpath2", xpath2)

        // Split the XPaths into arrays of steps
        var steps1 = xpath1.split('/');
        var steps2 = xpath2.split('/');

        // Initialize an empty array to store the common steps
        var commonSteps = [];

        // Iterate over the steps of both XPaths
        for (var i = 0; i < Math.min(steps1.length, steps2.length); i++) {
            var step1 = steps1[i];
            var step2 = steps2[i];

            // If the steps are identical, add the step to the common steps
            if (step1 === step2) {
            commonSteps.push(step1);
            } else {
            // Extract the tag name and index from each step
            var tagName1 = step1.match(/^[a-zA-Z]+/)[0];
            var tagName2 = step2.match(/^[a-zA-Z]+/)[0];
            var index1 = step1.match(/\[(\d+)\]$/)[1];
            var index2 = step2.match(/\[(\d+)\]$/)[1];

            // If the tag names are the same but the indexes are different
            if (tagName1 === tagName2 && index1 !== index2) {
                // Add the step with [x] as the index
                commonSteps.push(tagName1 + '[x]');
            } else {
                // If the tag names are different, stop comparing further steps
                break;
            }
            }
        }

        // Join the common steps into a complete XPath
        var commonXPath = commonSteps.join('/');

        // Add a leading slash if the XPath starts with a step
        if (commonXPath && commonXPath[0] !== '/') {
            commonXPath = '/' + commonXPath;
        }

        console.log("Common XPath", commonXPath)

        // Return the common XPath
        return commonXPath;
    }
    
    function getCommonXPath(elements) {
        if (elements.length === 0) return null // No elements provided

        // Get XPath for the first element
        var firstElement = elements[0]
        var commonXPath = getXPath(firstElement)

        // Iterate over the rest of the elements
        for (var i = 1; i < elements.length; i++) {
            var currentElement = elements[i]
            var currentXPath = getXPath(currentElement)

            // Find the common part of the XPaths
            var commonPart = '';
            for (var j = 0; j < Math.min(commonXPath.length, currentXPath.length); j++) {
                if (commonXPath[j] === currentXPath[j]) {
                    commonPart += commonXPath[j]
                } else {
                    break
                }
            }

            // Update commonXPath with the common part
            commonXPath = commonPart;
        }

        // Return the common XPath
        return commonXPath
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
        'LIST': 16,
        'SELECT': 17,
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
        text: string
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
        xpath: string

        // Leaf node segment of "semantic content"
        constructor(el: any, index: number, isIFrame: boolean, iframePosition: { x: number, y: number }, offset = 0) {
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
            this.xpath = el.xpath

            // If the element is inside an iframe
            this.isIFrame = isIFrame
            this.iframePosition = iframePosition

            if (offset !== 0) this.bbox.y += offset
        }

        isTriggerable(el) {
            try {
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
        isClickable(el) {
            try {
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
        getBoundingBox(el) {
            let _bbox = el.getBoundingClientRect()
            if (_bbox.width == 0 || _bbox.height == 0) return el.parentElement.getBoundingClientRect()
            else return _bbox
        }
        getLabel(el) {
            try {
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

                return ''

            }
        }
        isButton(data) {
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
        isInput(data) {
            try {
                let tagName = data.tagName
                return tagName == 'INPUT' || tagName == 'SELECT' || tagName == 'OPTION' || tagName == 'TEXTAREA'
            } catch (e) {
                return false
            }
        }
        isCustom(data) {
            try {
                let tagName = data.tagName
                return window.customElements.get(tagName.toLowerCase())
            } catch (e) {
                return false
            }
        }
        isText(data) {
            try {
                let tagName = data.tagName
                let hasText = data.hasText
                return hasText && (tagName == 'P' || tagName == 'SPAN' || tagName == 'ABBR' || tagName == 'LABEL' || tagName == 'DIV' || tagName == 'LI')
            } catch (e) {
                return false
            }
        }
        isLink(data) {
            try {
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
        isHeader(data) {
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
        isCode(data) {
            try {
                let tagName = data.tagName
                return (tagName == 'PRE' || tagName == 'CODE')
            } catch (e) {
                return false
            }
        }
        isQuote(data) {
            try {
                let tagName = data.tagName
                return (tagName == 'BLOCKQUOTE')
            } catch (e) {
                return false
            }
        }
        isImage(data) {
            try {
                // todo: check if SVG or IMG
                let tagName = data.tagName
                let el = data.el
                if (tagName == 'IMG' || (tagName == 'SVG' && this.bbox.height * this.bbox.width > 800))
                    return true
                else {
                    let isBackgroundImage = (window.getComputedStyle(el).backgroundImage.slice(0, 3) == 'url')
                    if (isBackgroundImage) {
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
        isIcon(data) {
            try {
                let tagName = data.tagName
                let el = data.el
                let isSVG = (tagName == 'SVG')
                let isSmall = (this.bbox.height * this.bbox.width < 800)
                let isKBD = (tagName == 'KBD')

                if (isKBD || isSVG && isSmall) {
                    return true
                }
                else {
                    let isBackgroundImage = (window.getComputedStyle(el).backgroundImage.slice(0, 3) == 'url')
                    if (isBackgroundImage) {
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
        isList(data) {
            try {
                let tagName = data.tagName
                return (tagName == 'TABLE' || tagName == 'UL' || tagName == 'OL' || tagName == 'DL')
            } catch (e) {
                return false
            }
        }
        getDescription(el) {
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
        getText(el) {
            try {
                let text = el.innerText ? el.innerText : ''
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
                if (!text) return ""
                return text
            } catch (e) {
                return ''
            }
        }
        getInputType(el) {
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
        getSelectOptions(el) {
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
        serialize() {

            // TODO: fix from the logicrite side
            // remove $ because they ruin the logicrite inputs 
            var className = this.el.className.toString()
            var idName = this.el.id.toString()
            var text = this.text.toString()

            let data = {
                'id': idName,
                'class': className,
                'index': this.index,
                'tagName': this.tagName,
                'x': (this.isIFrame ? this.bbox.x + this.iframePosition.x : this.bbox.x),
                'y': (this.isIFrame ? this.bbox.y + this.iframePosition.y : this.bbox.y),
                'width': this.bbox.width,
                'height': this.bbox.height,
                'text': text,
                'interactivity': [this.isElmClickable ? 'clickable' : 'non-clickable', this.isTriggerable ? 'trigger' : 'non-trigger'],
                'inputType': this.inputType,
                'isIframe': this.isIFrame,
                'iframePosition': this.iframePosition,
                'xpath': this.xpath,
            }

            let isButton = this.isButton({
                'tagName': this.el.tagName.toUpperCase(),
                'classlist': this.el.classList,
                'el': this.el
            })

            if (isButton) data['tagName'] = "BUTTON"
            if (this.tagName == 'SELECT') data['options'] = this.getSelectOptions(this.el)
            if (this.tagName == 'INPUT') {
                if (this.el.getAttribute('placeholder') != null) {
                    data['placeholder'] = this.el.getAttribute('placeholder').replace(/\$/g, '')
                }

                if (this.el.hasAttribute("src")) {
                    data['src'] = this.el.getAttribute('src')
                }
                if (this.el.value !== undefined) {
                    data['value'] = this.el.value
                }
            }
            if (this.tagName == 'IMG') data['src'] = this.el.getAttribute('src')
            // if href exist , add it 
            if (this.tagName == 'A' && this.el.getAttribute('href')) data['href'] = this.el.getAttribute('href')

            return data
        }
    }


    function isVisible(element) {
        // Check if the element itself is not displayed or has zero opacity
        if (element.style.display === 'none' || element.style.visibility === 'hidden' || element.style.opacity === '0') {
            return false;
        }

        // Check computed style to see if it or any of its parents are effectively hidden
        let style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }

        // Check if the element has no offset dimensions
        if (element.offsetWidth === 0 && element.offsetHeight === 0) {
            return false;
        }

        // Check if the element or any of its parents are hidden via 'display: none'
        while (element) {
            if (getComputedStyle(element).display === 'none') {
                return false;
            }
            element = element.parentElement;
        }

        return true;
    }
    


    // Helper function to check if XPaths match
    function isMatchingXPath(xpath, xpathTemplate) {
        const xpathSegments = xpath.split('/');
        const templateSegments = xpathTemplate.split('/');

        if (xpathSegments.length !== templateSegments.length) {
            return false;
        }

        for (let i = 0; i < xpathSegments.length; i++) {
            const xpathSegment = xpathSegments[i];
            const templateSegment = templateSegments[i];

            if (templateSegment.includes('[x]')) {
                // Extract the tag name from the template segment
                const tagName = templateSegment.split('[')[0];

                // Extract the tag name from the xpath segment
                const xpathTagName = xpathSegment.split('[')[0];

                if (tagName !== xpathTagName) {
                    return false;
                }
            } else {
                if (xpathSegment !== templateSegment) {
                    return false;
                }
            }
        }

        return true;
    }


    function checkAndRemoveSingleDifferentElement(elements) {
        const classCount = {};
        elements = Array.from(elements); // Ensure elements is a mutable array

        // Count occurrences of each class
        elements.forEach(el => {
            const className = el.className; // Assuming each element has only one class for simplicity
            if (classCount[className]) {
                classCount[className].count++;
                classCount[className].lastElement = el;
            } else {
                classCount[className] = { count: 1, lastElement: el };
            }
        });

        // Check if there's exactly one class with exactly one occurrence
        const classes = Object.keys(classCount);
        let uniqueClass = null;

        if (classes.length > 1) {
            // Find the class name that appears only once
            const uniqueClasses = classes.filter(className => classCount[className].count === 1);
            if (uniqueClasses.length === 1) {
                // Only one class should be unique and appear only once
                uniqueClass = uniqueClasses[0];
            }
        }

        // If there is a unique class that appears only once, remove that element from the list
        if (uniqueClass) {
            const elementToRemove = classCount[uniqueClass].lastElement;
            elements = elements.filter(el => el !== elementToRemove);
            console.log(`Removed element with unique class '${uniqueClass}' from the list.`);
        } else {
            console.log("No action taken, criteria not met.");
        }

        return elements; // Return the updated list of elements
    }

/*     function getElementByTagAtPoint(x, y, tagName) {
        // Scroll to the specific x, y position before getting the element
        // Note: This might adjust the visible area depending on how you handle scrolling.

        var scrollX = x;
        var scrollY = y - window.innerHeight / 2;
        if (scrollY < 0) {
            scrollY = 0;
        }

        window.scrollTo(scrollX, scrollY);

        var elementXrelativeToViewport = x;
        var elementYrelativeToViewport = y - scrollY;

        // Get the element at the now-visible coordinates
        // let el: Element | null = document.elementFromPoint(elementXrelativeToViewport, elementYrelativeToViewport);
        let el: Element | null = document.elementFromPoint(elementXrelativeToViewport, elementYrelativeToViewport);


        // If no element is found at the point, return null
        if (el === null) {
            return null;
        }

        let originalEl = el;
        // Traverse up the DOM until you find the desired tag or hit the document's root
        while (el && el.tagName !== tagName.toUpperCase() && el !== document.documentElement) {
            el = el.parentNode as Element;
        }


        // Return the element if it matches the tag, otherwise return the original element
        return el.tagName === tagName.toUpperCase() ? el : originalEl;
    }
 */
    

    
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

    function getElementByTagAtPoint(x, y, tagName) {
        // Scroll to the specific x, y position before getting the element
        var scrollX = x;
        var scrollY = y - window.innerHeight / 2;
        if (scrollY < 0) {
            scrollY = 0;
        }

        window.scrollTo(scrollX, scrollY);

        var elementXrelativeToViewport = x;
        var elementYrelativeToViewport = y - scrollY;

        // Get the element at the now-visible coordinates
        let el = document.elementFromPoint(elementXrelativeToViewport, elementYrelativeToViewport);

        // If no element is found at the point, return null
        if (el === null) {
            return null;
        }



        var elementA = null;
        var elementAstyle = '';
        // check if the tagName is not A, and the el is A
        if (tagName !== 'A' && el.tagName === 'A' && checkIfHrefIsLink(el) && getDirectTextContent(el) == '') {
            elementA = el;
            elementAstyle = elementA.style.pointerEvents;
            elementA.style.pointerEvents = 'none';

            el = document.elementFromPoint(elementXrelativeToViewport, elementYrelativeToViewport);
        }


        // Check if the element itself has the desired tagName
        if (el.tagName === tagName.toUpperCase()) {

            if(elementA != null) elementA.style.pointerEvents = elementAstyle;

            return el;
        }

        // Check immediate children of the element
        for (let child of el.children) {
            if (child.tagName === tagName.toUpperCase()) {
                
                if(elementA != null) elementA.style.pointerEvents = elementAstyle;

                return child;
            }
        }

        // Traverse up the DOM to find a matching parent element
        let parent = el.parentNode as Element;
        while (parent && parent !== document.documentElement) {
            if (parent.tagName === tagName.toUpperCase()) {

                if(elementA != null) elementA.style.pointerEvents = elementAstyle;

                return parent;

            }
            parent = parent.parentNode as Element;
        }


        if(elementA != null) elementA.style.pointerEvents = elementAstyle;

        // Return the original element if no matching parent is found
        return el;
    }


    function haveSameClasses(element1, element2) {
        // Get the class lists of both elements
        const classList1 = element1.classList;
        const classList2 = element2.classList;

        // Check if both class lists have the same length
        if (classList1.length !== classList2.length) {
            return false;
        }

        // Check each class in classList1 to see if classList2 contains it
        for (let className of classList1) {
            if (!classList2.contains(className)) {
                return false; // If any class from classList1 is not in classList2, return false
            }
        }

        // If all checks pass, return true
        return true;
    }




    const segments = [];
    const segmentsClass = [];

    const htmlElements = [];
    // get initial scroll position
    const initialScroll = window.scrollY;

    console.log("Elements", elms);

    for (let i = 0; i < elms.length; i++) {
        // let el = document.elementFromPoint(elms[i].x, elms[i].y);
        let el = getElementByTagAtPoint(elms[i].x, elms[i].y + initialScroll, elms[i].tagName)
        if(el != null) {
            console.log("Element: " + elms[i].tagName, el);
            htmlElements.push(el);
        }
    }

    // reset scroll position
    window.scrollTo(0, initialScroll);


    console.log("HTML Elements f4kaw9p", htmlElements);


    var previousXPathTemplate = '';

    for(let j = 0; j < htmlElements.length; j++) {


        var commonXPath = '';

        if(previousXPathTemplate == '') {
            // Find Common XPath
            commonXPath = getCommonXPathTemplate(htmlElements[j], htmlElements[j + 1]);
            console.log("Common XPath1", commonXPath);

            previousXPathTemplate = commonXPath;

            // increement j by 1
            j = j + 1;

        } else {
            commonXPath = getXPath(htmlElements[j]);
            
            var firstPart = previousXPathTemplate.split('[x]')[0];

            var remainingPart = commonXPath.split(firstPart)[1].split('/')[0];

            var secondPart = commonXPath.split(firstPart)[1].replace(remainingPart, '[x]');

            commonXPath = firstPart + secondPart;

        }

        

        // get tag name of first element
        const tagName = htmlElements[j].tagName;

        // Find Similar Elements
        let similarElements = [];

        var similarElementsClass = [];

        const allElements = document.getElementsByTagName(tagName);
        for (let i = 0; i < allElements.length; i++) {
            const element = allElements[i];
            const elementXPath = getXPath(element);
            if (isMatchingXPath(elementXPath, commonXPath)) {
                element.xpath = elementXPath;
                similarElements.push(element);
            }
            // if(haveSameClasses(element, htmlElements[j])) {
            //     similarElementsClass.push(element);
            // }
        }
        console.log("Match Elements", similarElements);


        // loop through similarElements array and check if all have the same class except for 1
        // if only one element has a different class, remove it from the array

        if(similarElements.length > 2) {
            similarElements = checkAndRemoveSingleDifferentElement(similarElements);
        }

        






       

        for (let i = 0; i < similarElements.length; i++) {
            const element = similarElements[i];

            if(typeof segments[i] == 'undefined') {
                segments[i] = [];
            }

            segments[i].push(
                new ELM(
                    element,
                    -1,
                    false,
                    { x: 0, y: 0 }
                ).serialize()
            );
        }
/* 
        for (let i = 0; i < similarElementsClass.length; i++) {
            const element = similarElementsClass[i];

            if(typeof segmentsClass[i] == 'undefined') {
                segmentsClass[i] = [];
            }

            segmentsClass[i].push(
                new ELM(
                    element,
                    -1,
                    false,
                    { x: 0, y: 0 }
                ).serialize()
            );
        } */

        /* 
            algorithm using class:
            1. get all elements with the same tag name and class name 'TAGNAME.CLASSNAME'. They have to have a class name.
            2. if all the elements have the same size, or the same x, return all the elements.
            
            // same as above but using the parent element if the class is empty


        */

    }

    

    // return {
    //     segments: segments,
    //     segmentsClass: segmentsClass
    // };

    return segments;

}