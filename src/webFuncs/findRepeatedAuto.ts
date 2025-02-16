// TODO - grouping 
// ycombinator top companies
// columns
export async function findRepeatedAuto(
    elms: { x: number, y: number, tagName: string }[],
    propertiesToCheck: {
        tagName: boolean
        parent: boolean
        className: boolean
        backgroundColor: boolean
        x: boolean
        y: boolean
        width: boolean
        height: boolean
        color: boolean
        text: boolean
        src: boolean
        href: boolean
        fontSize: boolean
        fontWeight: boolean
    }
) {
    // function getXPath(element) {
    //     let xpath = ''
    //     for (; element && element.nodeType == 1; element = element.parentNode) {
    //         let id = (Array.from(element.parentNode.children).indexOf(element) + 1).toString()
    //         id = Number(id) > 1 ? `[${id}]` : ''
    //         xpath = '/' + element.tagName.toLowerCase() + id + xpath
    //     }
    //     return xpath
    // }

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

    function getElementByTagAtPoint(x, y, tagName, initialScroll) {
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



/* 

    function findRelativeSelector(startElement, targetElement) {
        if (!startElement || !targetElement) {
            return null;  // Ensure both elements exist
        }

        // Find the path from each element to the document root
        function getPathToRoot(elem) {
            const path = [];
            while (elem) {
                const parent = elem.parentElement;
                if (!parent) break;
                let index = Array.prototype.indexOf.call(parent.children, elem) + 1;
                path.unshift(`${elem.tagName.toLowerCase()}:nth-child(${index})`);
                elem = parent;
            }
            return path;
        }

        const pathA = getPathToRoot(startElement);
        const pathB = getPathToRoot(targetElement);

        // Find common path length from root
        let commonLength = 0;
        while (pathA[commonLength] === pathB[commonLength]) {
            if (!pathA[commonLength] || !pathB[commonLength]) break;
            commonLength++;
        }

        // Create the relative path
        let relativePath = '';
        let stepsUp = pathA.length - commonLength; // steps up from startElement to common ancestor
        for (let i = 0; i < stepsUp; i++) {
            relativePath += ' > parent';
        }
        if (stepsUp > 0 && pathB.length > commonLength) {
            relativePath += ' ';
        }
        let stepsDown = pathB.slice(commonLength).join(' > ');
        if (stepsDown) {
            relativePath += stepsDown;
        }

        return relativePath;
    }


    function navigateUsingPath(startElement, path) {
        let currentElement = startElement;

        // Split the path into parts
        const steps = path.split(' > ');

        // Iterate over each part
        steps.forEach(step => {
            if (step === 'parent') {
                // Move up to the parent element
                currentElement = currentElement.parentElement;
            } else if (step.includes('nth-child')) {
                // Extract the index and move to that child element
                const match = step.match(/nth-child\((\d+)\)/);
                if (match && match[1]) {
                    const index = parseInt(match[1], 10) - 1;  // Convert to zero-based index
                    currentElement = currentElement.parentElement.children[index];
                }
            } else {
                // For tag selectors, find the first matching child
                const children = Array.from(currentElement.children);
                currentElement = children.find(child => child.tagName.toLowerCase() === step);
            }
        });

        return currentElement;
    }

 */


    






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


    function cleanClassString(classString) {
        // Remove leading/trailing whitespace and replace multiple whitespace characters (including line breaks) with a single space
        return classString.trim().replace(/\s+/g, ' ');
    }



    function getMatchingElements(specs) {
        // Retrieve all elements from the document

        // check first if some of the specs can help us filter the elements to improve performance

        var query = '';
        if (specs.tagName) {
            query += specs.tagName.toLowerCase();
        }
        if (specs.className) {
            specs.className = cleanClassString(specs.className);
            query += '.' + specs.className.split(' ').join('.');
        }
        if (specs.src) {
            query += `[src*="${specs.src}"]`;
        }
        if (specs.href) {
            query += `[href*="${specs.href}"]`;
        }

        if(query == '') {
            query = '*'
        }


        const allElements = document.querySelectorAll(query);

        var matchedElements = [];

        console.log('allElements', allElements.length)

        

        // Iterate over all elements to find matches
        allElements.forEach(element => {

            if(element.id == 'xxx' || element.id == 'yyy') {
                console.log('xxxelement', element, isVisible(element))
            }


            if(isVisible(element)) {

                let matchesSpec = true;

                var specsClone = JSON.parse(JSON.stringify(specs));
                var elementSpecs = getElementProperties(element, specsClone);


                // compare each spec with elementSpecs

                Object.keys(specs).forEach(spec => {


                    let value = specs[spec];
                    let elementValue = elementSpecs[spec];
                    if(element.id == 'xxx' || element.id == 'yyy') {
                        console.log('xxxyyy', spec, value, elementValue)
                    }
                    if (value != elementValue) {
                        matchesSpec = false;
                    }
                });

                // If all specs match and the element is visible, style it
                if (matchesSpec) {
                    matchedElements.push(element);
                }

            }

        });

        return matchedElements;
    }







    function getElementProperties(element, specs) {
        if (!element) {
            console.error('Specified element does not exist');
            return;  // Exit the function if the element is null
        }

        // Declare rect here so it's available throughout the whole function
        const rect = element.getBoundingClientRect();  

        Object.keys(specs).forEach(spec => {
            switch (spec) {
                case 'width':
                case 'height':
                    // Use the previously declared rect
                    specs[spec] = rect[spec];
                    break;
                case 'x':
                case 'y':
                    // Use the previously declared rect and include scroll positions
                    specs[spec] = (spec === 'x' ? rect.left : rect.top );
                    break;
                case 'tagName':
                    specs[spec] = element.tagName.toLowerCase();
                    break;
                case 'parent':
                    /* specs[spec] = element.parentElement ? element.parentElement.tagName.toLowerCase() : null;
                    break; */
                    // Simplified to include just the tag name and class names of the parent
                    if (element.parentElement) {
                        const parent = element.parentElement;
                        let selector = parent.tagName.toLowerCase(); // Start with the tag name
                        const classList = parent.className.trim(); // Get the full class string
                        if (classList) {  // Check if there are any class names
                            selector += ' ' + classList; // Append class names separated by spaces
                        }
                        specs[spec] = selector;
                    } else {
                        specs[spec] = null; // No parent element
                    }
                    break;
                case 'text':
                    specs[spec] = element.textContent.trim();
                    break;
                case 'className':
                    specs[spec] = element.className;
                    break;
                case 'href':
                case 'src':
                    specs[spec] = element.getAttribute(spec);
                    break;
                case 'backgroundColor':
                case 'color':
                case 'fontSize':
                case 'fontWeight':
                    // Get computed styles for these CSS properties
                    specs[spec] = window.getComputedStyle(element)[spec];
                    break;
                default:
                    specs[spec] = element.getAttribute(spec);
            }
        });
        return specs;
    }






    





/* 
    // Example usage:
    let sampleSpecs = {
        width: '',
        height: '',
        x: '',
        y: '',
        tagName: '',
        text: '',
        className: '',
        href: '',
        src: '',
        backgroundColor: '',
        color: '',
        fontSize: '',
        fontWeight: ''
    };

    let someElement = document.getElementById('xxx');
    console.log('someElement', someElement)

    var specs = getElementProperties(someElement, sampleSpecs);
    // console.log(specs); 

    var selectedSpecs = {
        // width: specs.width,
        height: specs.height,
        // x: specs.x,
        // y: specs.y,
        tagName: specs.tagName,
        // text: specs.text,
        className: specs.className,
        // href: specs.href,
        src: specs.src,
        // backgroundColor: specs.backgroundColor,
        color: specs.color,
        fontSize: specs.fontSize,
        fontWeight: specs.fontWeight
    }

    console.log('selectedSpecs', selectedSpecs)
    var matchingElements = getMatchingElements(selectedSpecs)

    for (let i = 0; i < matchingElements.length; i++) {
        // change background color to 0.5 opacity red
        matchingElements[i].style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
    }

    console.log('matchingElements', matchingElements.length)


 */
 







    function generateXPath(element) {
        if (!element || !element.tagName) return null;
        let path = [];

        while (element.nodeType === Node.ELEMENT_NODE) {
            let index = 1;  // XPath indices start at 1
            for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue;
                if (sibling.nodeName === element.nodeName) index++;
            }
            let tagName = element.nodeName.toLowerCase();
            let segment = `${tagName}[${index}]`;
            path.unshift(segment);  // Push to the beginning of the array
            element = element.parentNode;
        }

        return '/' + path.join('/');
    }


    function findRelativeXPath(element1, element2) {
        let path1 = generateXPath(element1).split('/');
        let path2 = generateXPath(element2).split('/');
        let length = Math.min(path1.length, path2.length);
        let i = 0;

        // Find the divergence point
        while (i < length && path1[i] === path2[i]) {
            i++;
        }

        // Navigate up to the common ancestor
        let up = path1.length - i;
        let down = path2.slice(i).join('/');

        let relativePath = Array(up).fill('..').join('/') + '/' + down;
        return relativePath;
    }



    function getElementByXPath(startElement, relativeXPath) {
        // This will execute the XPath relative to the startElement
        const iterator = document.evaluate(relativeXPath, startElement, null, XPathResult.ANY_TYPE, null);
        return iterator.iterateNext();
    }

    function getElementsByXPath(startElement, relativeXPath) {
        // This will execute the XPath relative to the startElement and collect all matching elements
        const snapshot = document.evaluate(relativeXPath, startElement, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        
        // Create an array to hold all the matching elements
        const results = [];
        for (let i = 0; i < snapshot.snapshotLength; i++) {
            results.push(snapshot.snapshotItem(i));
        }
        
        return results;
    }

/* 

    let element1 = document.getElementById('xxx');
    let element2 = document.getElementById('yyy');
    let relativeXPath = findRelativeXPath(element1, element2);
    console.log('Relative XPath:', relativeXPath);


    let targetElement = getElementByXPath(element1, relativeXPath);
    console.log('Target Element Retrieved:', targetElement); */












    console.log("----------------------------")
    console.log("----------------------------")


    // const elements = elms.map((elm) => document.elementFromPoint(elm.x, elm.y))
    const initialScroll = window.scrollY;
    var elements = []
    for (let i = 0; i < elms.length; i++) {
        let elm = elms[i]
        let element = getElementByTagAtPoint(elm.x, elm.y + initialScroll, elm.tagName, initialScroll)
        elements.push(element)
    }
    window.scrollTo(0, initialScroll);


    console.log("Elements fjao9", elements)







    function levelsToCommonAncestor(elem1, elem2) {
        let path1 = [];
        let path2 = [];
        let current1 = elem1;
        let current2 = elem2;

        // Build the path up the DOM tree for the first element
        while (current1) {
            path1.push(current1);
            current1 = current1.parentNode;
        }

        // Build the path up the DOM tree for the second element
        while (current2) {
            path2.push(current2);
            current2 = current2.parentNode;
        }

        // Reverse the paths to start from the root
        path1.reverse();
        path2.reverse();

        // Find the shortest path to the common ancestor
        let minLength = Math.min(path1.length, path2.length);
        let levelCount1 = 0;
        let levelCount2 = 0;

        // Determine the point where paths diverge
        for (let i = 0; i < minLength; i++) {
            if (path1[i] !== path2[i]) {
                levelCount1 = path1.length - i; // Number of steps from elem1 to the common ancestor
                levelCount2 = path2.length - i; // Number of steps from elem2 to the common ancestor
                break;
            }
        }

        // Return the shortest level count to reach a common ancestor
        return Math.min(levelCount1, levelCount2);
    }











    let sampleSpecs = {
    };

    for (var key in propertiesToCheck) {
        sampleSpecs[key] = '';
    }

    console.log('sampleSpecs', sampleSpecs)

    var segments = [];


    var commonSpecs = null;
    var relativeXPaths = {};

    var matchingElements = [];
    
    for(var i = 1; i < elements.length; i++) {
        if(elements[i] == null) {
            return [];
        }

        var element = elements[i];

        

        if(i == 1) {

            var specs = getElementProperties(elements[0], JSON.parse(JSON.stringify(sampleSpecs)));
            console.log('specs', specs)

            var specs0 = getElementProperties(elements[1], JSON.parse(JSON.stringify(sampleSpecs)));
            console.log('specs0', specs0)

            commonSpecs = {};

            for (var key in specs0) {
                if(specs0[key] == specs[key]) {
                    commonSpecs[key] = specs[key];
                }
            }

            // remove some specs like text
            delete commonSpecs.text;
            // delete commonSpecs.href;
            // delete commonSpecs.src;




            matchingElements = getMatchingElements(commonSpecs);

            for (var j = 0; j < matchingElements.length; j++) {

                var matchedElement = matchingElements[j];
                matchedElement.xpath = getXPath(matchedElement);
                matchingElements[j] = matchedElement;


                if (typeof segments[j] == 'undefined') {
                    segments[j] = [];
                }

                segments[j].push(
                    new ELM(
                        matchedElement,
                        -1,
                        false,
                        { x: 0, y: 0 }
                    ).serialize()
                );

            }



        } else {
            
            // sometimes the user might pick an element that is not belonging to the current row, but another row, this ruins the relative path
            // we need to find the closest row element to the current element

            // loop through matching elements and find the one with the closest mutual parent with the current element


            var closestElement = null;
            var closestCommon = -1;

            console.log('#####################');

            for (var j = 0; j < matchingElements.length; j++) {

                var matchedElement = matchingElements[j];
                var matchedElementClosestCommon = levelsToCommonAncestor(element, matchedElement);

                if (closestCommon == -1) {
                    closestCommon = matchedElementClosestCommon;
                    closestElement = matchedElement;
                } else {
                    if (matchedElementClosestCommon < closestCommon) {
                        closestCommon = matchedElementClosestCommon;
                        closestElement = matchedElement;
                    }
                }
                if(j < 10) {
                    console.log('matchedElement', j, element, matchedElement, matchedElementClosestCommon)
                    console.log('---------------------');
                }

            }

            console.log('#####################');

            console.log('closestElement', closestElement, closestCommon);

            relativeXPaths[i] = findRelativeXPath(closestElement, element);


        }

    }


    
    console.log('commonSpecs', commonSpecs)
    console.log('relativeXPaths', relativeXPaths)
    console.log('segments', segments)




    if(elements.length > 2) {

        for(var i = 2; i < elements.length; i++) {

            for (var j = 0; j < matchingElements.length; j++) {

                var matchedElement = matchingElements[j];
                var relativeXPath = relativeXPaths[i];

                try {
                    let targetElement = getElementByXPath(matchedElement, relativeXPath) as any;
                    targetElement.xpath = getXPath(targetElement);

                    segments[j].push(
                        new ELM(
                            targetElement,
                            -1,
                            false,
                            { x: 0, y: 0 }
                        ).serialize()
                    );

                    /* let targetElements = getElementsByXPath(matchedElement, relativeXPath) as any;
    
                    for (var k = 0; k < targetElements.length; k++) {
                        let targetElement = targetElements[k];
                        targetElement.xpath = getXPath(targetElement);
                    }

                    if(targetElements.length == 1) {
                        segments[j].push(
                            new ELM(
                                targetElements[0],
                                -1,
                                false,
                                { x: 0, y: 0 }
                            ).serialize()
                        );
                    } else {

                        // TODO: this did not work, so we it is always 1 element

                        var list = [];
                        for (var k = 0; k < targetElements.length; k++) {
                            list.push(new ELM(
                                targetElements[k],
                                -1,
                                false,
                                { x: 0, y: 0 }
                            ).serialize());
                        }

                        segments[j].push(list);

                    }
 */
                    
                } catch (e) {
                    
                    // sometimes there's a mismatch between the number of elements in each column

                    let data = {
                        'id': '',
                        'class': '',
                        'index': '',
                        'tagName': '',
                        'x': 0,
                        'y': 0,
                        'width': 0,
                        'height': 0,
                        'text': '',
                        'interactivity': ['non-clickable', 'non-trigger'],
                        'inputType': '',
                        'isIframe': false,
                        'iframePosition': { x: 0, y: 0 },
                        'xpath': '',
                    }

                    segments[j].push(
                        data
                    );

                }
                

            }

            
        }
    
    }




    console.log('segments', segments)

    return segments






} 