export function segmentDOM([viewportWidth, viewportHeight]) : any{

    // Types of DOM nodes
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
    const invisible_nodes = ['HEAD', 'META', 'STYLE', 'NOSCRIPT', 'SCRIPT', 'TEMPLATE', 'CENTER', 'DATA', 'EMBED', '<!--...-->', 'BDI']
    const skipped_nodes = ['IFAME', 'BR', /*'B'/, /* 'I', */ 'STRONG', 'EM', 'LEGEND']
    const leaf_nodes = ['SVG', 'IMG', 'PRE', 'CODE', 'TEXTAREA', 'INPUT', 'BLOCKQUOTE']
    const leaf_nodes_composite = ['TABLE', 'UL', 'OL', 'DL', 'P', 'BUTTON', 'FORM', 'FOOTER', 'NAV']
    const minImageArea = 800

    // DIV HANDLING
    // TODO: check if label is clickable => radio, checkbox, link
    class Segment {
        // Properties
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

        // Leaf node segment of "semantic content"
        constructor(el: any, index:number, isIFrame:boolean, iframePosition:{ x: number, y: number }, offset=0){
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

            // If the element is inside an iframe
            this.isIFrame = isIFrame
            this.iframePosition = iframePosition

            if (offset !== 0) this.bbox.y += offset
        }

        isTriggerable(el){
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
        }
        isClickable(el){
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
        }
        getBoundingBox(el){
            let bbox = el.getBoundingClientRect()
            if(bbox.width == 0 || bbox.height == 0) return el.parentElement.getBoundingClientRect()
            else return bbox
        }
        getLabel(el){
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
        }
        isButton(data){
            // Should go after a link check
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
        }
        isInput(data){
            let tagName = data.tagName
            return tagName == 'INPUT' || tagName == 'SELECT' || tagName == 'OPTION' || tagName == 'TEXTAREA'
        }
        isCustom(data){
            let tagName = data.tagName
            return window.customElements.get(tagName.toLowerCase())
        }
        isText(data){
            let tagName = data.tagName
            let hasText = data.hasText
            return hasText && (tagName == 'P' || tagName == 'SPAN' || tagName == 'ABBR' || tagName == 'LABEL' || tagName == 'DIV'|| tagName == 'LI')
        }
        isLink(data){
            let tagName = data.tagName
            let parentTagName = data.parentTagName
            let classlist = data.classlist

            let linkNotButton = (tagName == 'A' && !classlist.contains('btn') && !classlist.contains('button'))
            let parentIsLink = (parentTagName == 'A' && (tagName == 'P' || tagName == 'SPAN' || tagName == 'ABBR' || tagName == 'ADDRESS'))
            let citeElement = (tagName == 'CITE')
            return linkNotButton || parentIsLink || citeElement
        }
        isHeader(data){
            let tagName = data.tagName
            let parentTagName = data.parentTagName
            let hasText = data.hasText

            let isHeader = (hasText && (tagName == 'H1' || tagName == 'H2' || tagName == 'H3' || tagName == 'H4' || tagName == 'H5' || tagName == 'H6'))
            let isParentHeader = (hasText && (parentTagName == 'H1' || parentTagName == 'H2' || parentTagName == 'H3' || parentTagName == 'H4' || parentTagName == 'H5' || parentTagName == 'H6'))
            return isHeader || isParentHeader
        }
        isCode(data){
            let tagName = data.tagName
            return (tagName == 'PRE' || tagName == 'CODE')
        }
        isQuote(data){
            let tagName = data.tagName
            return (tagName == 'BLOCKQUOTE')
        }
        isImage(data){
            // todo: check if SVG or IMG
            let tagName = data.tagName
            let el = data.el
            if (tagName == 'IMG' || (tagName == 'SVG' && this.bbox.height * this.bbox.width > minImageArea))
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
        }
        isIcon(data){
            let tagName = data.tagName
            let el = data.el
            let isSVG = (tagName == 'SVG')
            let isSmall = (this.bbox.height * this.bbox.width < minImageArea)
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
        }
        isList(data){
            let tagName = data.tagName
            return (tagName == 'TABLE' || tagName == 'UL' || tagName == 'OL'|| tagName == 'DL')
        }
        getDescription(el){
            if (el.getAttribute('aria-label'))
                return el.getAttribute('aria-label')
            if (el.getAttribute('alt'))
                return el.getAttribute('alt')
            if (el.getAttribute('role'))
                return el.getAttribute('role')
            return ''
        }
        getSegmentFromPoint(viewportHeight){
            let centerX = this.bbox.x + this.bbox.width / 2
            let centerY = this.bbox.y + this.bbox.height / 2

            // Scroll page so element is in view in increments of `viewportHeight`
            let offset = 0
            while (this.bbox.y > offset + viewportHeight)
                offset += viewportHeight

            let scrollY = window.scrollY
            if (scrollY != offset) window.scrollTo(0, offset)

            let el = document.elementFromPoint(centerX, centerY - offset)

            if (el === null) return false

            // TODO: 
            return new Segment(el, offset, false, {x:0, y:0})
        }
        replaceWithSegmentFromPoint(viewportHeight){
            let segment = this.getSegmentFromPoint(viewportHeight)
            if (segment === false) return false

            this.el = segment.el
            this.bbox = segment.bbox
            this.label = segment.label

            return true
        }
        getText(el){
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
        }
        getInputType(el){
            let type = ''
            if (el.tagName.toUpperCase() == 'INPUT') {
                type = el.getAttribute('type')
            }

            return type
        }
        getSelectOptions(el){
            let options = []
            el.querySelectorAll('option').forEach((option, index) => {
                let op = { value: option.value, text: option.text }
                options.push(op)
            })
            return options
        }
        serialize(){

            let data = {
                'id': this.el.id,
                'class': this.el.className,
                'index': this.index,
                'tagName': this.tagName,
                'x': ( this.isIFrame ? this.bbox.x + this.iframePosition.x : this.bbox.x ),
                'y': ( this.isIFrame ? this.bbox.y + this.iframePosition.y : this.bbox.y ),
                'width': this.bbox.width,
                'height': this.bbox.height,
                'text': this.text,
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
                data['placeholder'] = this.el.getAttribute('placeholder')
                if(this.el.hasAttribute("src")){
                    data['src'] = this.el.getAttribute('src')
                }
            }
            if(this.tagName == 'IMG') data['src'] = this.el.getAttribute('src')
            // if href exist , add it 
            if(this.tagName == 'A' && this.el.getAttribute('href')) data['href'] = this.el.getAttribute('href')

            return data
        }
    }

    class Segments {
        segments:Segment[]
        // Segments is an iterable collection of Segment objects
        constructor(segments:Segment[]){
            this.segments = segments || []
        }
        // Add a Segment to the collection
        add(segment: Segment){
            this.segments.push(segment)
            return this
        }
        // Sort Segments by their bounding box's x coordinate
        sort(){
            this.segments.sort((a, b) => a.bbox.y - b.bbox.y)
            return this
        }
        // Filter out Segments that are too small
        [Symbol.iterator]() {
            let index = -1
            let data  = this.segments

            return {
                next: () => ({ value: data[++index], done: !(index in data) })
            }
        }
        uniquify(){
            let uniqueSegments = []
            let seen = new Set()
            for (let segment of this.segments){
                let key = segment.bbox.x + '_' + segment.bbox.y + '_' + segment.bbox.width + '_' + segment.bbox.height
                if (!seen.has(key)){
                    uniqueSegments.push(segment)
                    seen.add(key)
                }
            }
            return new Segments(uniqueSegments)
        }
        replaceWithSegmentFromPoint(){
            for (let segment of this.segments){
                segment.replaceWithSegmentFromPoint(viewportHeight)
            }
            return this
        }
        // Serialize Segments to JSON
        serialize(){
            let serializedSegments = []
            for (let segment of this.segments){
                serializedSegments.push(segment.serialize())
            }
            return serializedSegments
        }
    }

    // Find the overlap between two bounding boxes
    function getOverlap(a, b) {
        let x_overlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        let y_overlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        let overlapArea = x_overlap * y_overlap;
        let aArea = a.width * a.height;
        let bArea = b.width * b.height;
        let totalArea = aArea + bArea - overlapArea;
        return overlapArea / totalArea;
    }

    // SegmentGroups is an iterable collection of SegmentGroup objects, broken down by viewport height essentially
    class SegmentGroups {
        groups: Segments[]
        sectionLabels: string[]
        segments: Segments
        
        constructor(segments:Segments){
            this.sectionLabels = []
            this.groups = []
            this.segments = segments || new Segments([])
        }
        group(viewportHeight: number){
            let group = new Segments([])
            let offset = 0

            for (let segment of this.segments){
                if (segment.bbox.y < offset + viewportHeight){
                    segment.bbox.y -= offset
                    group.add(segment)
                }
                else {
                    this.groups.push(group)
                    group = new Segments([])
                    offset += viewportHeight
                }
            }
            this.groups.push(group)
            return this
        }
        groupBySection(){
            let sections = {
                'NAVS': [],
                'FORMS':[],
                'FOOTERS': [],
                'UNKNOWN': { bbox:{ x:0, y:0, width:viewportWidth, height:viewportHeight }, elements: new Segments([]) },
            }

            for (let segment of this.segments){
                // check if segment is on the page
                let x = (segment.bbox.x + (segment.bbox.width/2))
                let y = (segment.bbox.y + (segment.bbox.height/2))
                let elm = document.elementFromPoint(x, y)
                
                
                if(!elm || elm != segment.el) {
                    // if part of svg , treat as elm == segment.el
                    if(segment.el.tagName == 'svg') {
                        // Ignore svg elements

                    }
                    else {
                        // IFrame handling
                        if (segment.isIFrame){
                            //Adjust x and y for iframe
                            elm = document.elementFromPoint(x+segment.iframePosition.x, y+segment.iframePosition.y)
                            try{
                                //@ts-ignore
                                let iframeDoc = elm.contentDocument || elm.contentWindow.document
                                elm = iframeDoc.elementFromPoint(segment.bbox.x, segment.bbox.y) as HTMLElement
                                if (elm != segment.el) continue
                            } catch (e) { continue }
                        } else continue
                    }
                }

                //ignore the following elements
                if(
                    segment.label == 1 || //segment.label == 3 || 
                    segment.label == 4 || segment.label == 5 || 
                    segment.label == 9 || segment.label == 10 //|| 
                    //segment.label == 11
                ) continue

                // The groups
                if(segment.label == 15) {
                    sections['NAVS'].push({bbox:segment.bbox, elements: new Segments([])})
                } else if(segment.label == 14) {
                    sections['FOOTERS'].push({bbox:segment.bbox, elements:new Segments([])})
                } else if(segment.label == 8) {
                    console.log('found form', segment.bbox)
                    sections['FORMS'].push({bbox:segment.bbox, elements: new Segments([])})
                } else {
                    let found = false
                    for(let section in sections){
                        // if the segment does not belong to any of the above
                        if(section == 'UNKNOWN') {
                            sections.UNKNOWN.elements.add(segment)
                        } else {
                            for (let group of sections[section]) {

                                let overlap = getOverlap(segment.bbox, group.bbox)
                                if(overlap > 0) {
                                    group.elements.add(segment)
                                    found = true
                                    break
                                }
                            }
                            if (found) break
                        }
                    }
                }
            }

            let navsCount = 0
            let formsCount = 0

            for(let section in sections){
                let group = new Segments([])
                if(section == 'UNKNOWN') {
                    for (let element of sections[section].elements){
                        group.add(element)
                    }
                    this.groups.push(group)
                    this.sectionLabels.push("NOT_GROUPED")
                } else {
                    // ignore footers
                    if(section == 'FOOTERS') continue

                    for (let sectionGroup of sections[section]) {
                        // increment the count
                        if(section == 'NAVS') navsCount++
                        else formsCount++

                        let currIndex = (section == 'NAVS'? navsCount: formsCount)

                        let subGroup = new Segments([])
                        for (let element of sectionGroup.elements){
                            subGroup.add(element)
                        }
                        this.groups.push(subGroup)                        
                        this.sectionLabels.push(`${section.slice(0,section.length-1)}_${currIndex}`)
                    }
                }
                
            }

            return this
        }

        serialize(){
            let serializedSegmentGroups = []
            for (let group of this.groups){
                serializedSegmentGroups.push(group.serialize())
            }
            return serializedSegmentGroups
        }
    }

    // Breadth-first traversal of DOM tree
    let els = [document.body]
    let leaves = new Segments([])
    let index = 0
    while (els.length > 0) {
        let el = els.shift()

        if (el && el.nodeType == 8) continue // skip text nodes and comments
        
        // IframeHandling
        let isIFrame = false
        let iframePositions = {x:0, y:0}
        // Element is in not Iframe but it is part iframe
        if(el.ownerDocument !== document) {
            isIFrame=true

            // get position of iframe owner
            let iframeRect = el.ownerDocument.defaultView.frameElement.getBoundingClientRect()
            iframePositions={ x:iframeRect.x, y:iframeRect.y }
        }
        if (el instanceof HTMLIFrameElement){
            // Blocked a frame with origin "..." from accessing a cross-origin frame.
            try{
                let iframeDoc = el.contentDocument || el.contentWindow.document
                let iframeRect = el.getBoundingClientRect()

                //Get x and y 
                let adjustedX = iframeRect.x - iframeRect.left
                let adjustedY = iframeRect.y - iframeRect.top

                el = iframeDoc.elementFromPoint(adjustedX, adjustedY) as HTMLElement
                if (el == null) continue // if the element is null, skip it
            } catch (e) { continue }
        } 

        // ignore elements that is an empty text node
        if (el.nodeType == Node.TEXT_NODE && el.textContent.trim() !== ''){
            leaves.add(new Segment(el.parentElement, index, isIFrame, iframePositions))
            index++
            continue
        }

        // Checkbox
        if(el.tagName == "INPUT" && el.getAttribute("type") == "checkbox" ) {
            leaves.add(new Segment(el, index, isIFrame, iframePositions))
            index++
            continue
        }
        // Dropdown 
        if (el.tagName == "SELECT" ) {
            leaves.add(new Segment(el, index, isIFrame, iframePositions))
            index++
            continue
        }

        // IMAGEs
        if (el.tagName == "IMG" || el.tagName == "SVG") {
            leaves.add(new Segment(el, index, isIFrame, iframePositions))
            index++
            continue
        }

        // ignore elements that are not ELEMENT_NODE
        if (el && el.nodeType !== Node.ELEMENT_NODE) continue
        let nodeName = el.nodeName.toUpperCase()

        // Ignore elements that are not visible
        if (invisible_nodes.includes(nodeName) || skipped_nodes.includes(nodeName)) continue
        let computedStyle = window.getComputedStyle(el)

        // TODO: investigate el.checkVisibility() === false
        if (computedStyle.visibility == 'hidden' || computedStyle.visibility == 'none' || computedStyle.opacity === '0') continue

        // Atomic elements that we want to also double click into
        if (leaf_nodes_composite.includes(nodeName)) {
            leaves.add(new Segment(el, index, isIFrame, iframePositions))
            index++
        }

        // Atomic elements
        if (leaf_nodes.includes(nodeName)){
            leaves.add(new Segment(el, index, isIFrame, iframePositions))
            index++
            continue
        }

        // Other leaf elements: background images and text
        if (el.childElementCount == 0){
            if (el.textContent.trim() !== '')
                leaves.add(new Segment(el, index, isIFrame, iframePositions))

            if (window.getComputedStyle(el).backgroundImage.slice(0,3) == 'url')
                leaves.add(new Segment(el, index, isIFrame, iframePositions))

            index++
            continue
        }

        /*
        It should have no elements included in the existing dom list inside it
        it should not be a child of an element included in the list
        */
        if (el.tagName =="DIV" || el.tagName =="A" || el.tagName =="SPAN" || el.tagName =="IMG" || el.tagName =="LI") {

            // should be smaller than 200px by 200px
            let rect = el.getBoundingClientRect()
            if (rect.width < 200 && rect.height < 200) {
                //bigger than 5px and 5px
                if (rect.width > 5 && rect.height > 5) {
                    //It should have a cursor on it
                    if (window.getComputedStyle(el).cursor !== 'auto') {
                        // Should not have an import element inside it
                        let childNodes = el.querySelectorAll('div, a, span, img, li, input, select, button')
                        //TODO -
                        // let childNodes = el.querySelectorAll('div, a, span, img, li, input, select, button, iframe')
                        if (childNodes.length == 0) {
                            // check what element exist at el middle point position
                            let middleX = rect.x + rect.width/2
                            let middleY = rect.y + rect.height/2
                            let middleElement = document.elementFromPoint(middleX, middleY) as HTMLElement
                            if (middleElement && middleElement != el) {
                                el = middleElement
                            }

                            leaves.add(new Segment(el, index, isIFrame, iframePositions))
                            index++
                            continue
                        }
                    }
                }
            }
        }
        
        //@ts-ignore
        els.push(...el.childNodes)
    }

    let uniqueSegments = leaves.uniquify().sort()
    let segmentGroups = new SegmentGroups(uniqueSegments).groupBySection()

    // Merge by  sectionLabels
    let ungrouped = []
    let result = {}
    let labelIndex = 0
    let serializedGroups = segmentGroups.serialize()
    for( let sectionLabel of segmentGroups.sectionLabels){
        result[sectionLabel] = serializedGroups[labelIndex]

        for(let segment of serializedGroups[labelIndex]){
            ungrouped.push(segment)
        }
        
        labelIndex++
    }

    return [serializedGroups, segmentGroups.sectionLabels, ungrouped, result]
}