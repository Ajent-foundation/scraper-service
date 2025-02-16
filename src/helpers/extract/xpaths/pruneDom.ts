import JSON5 from 'json5';

function hasOnlySpecifiedAttributes(obj) {
	const allowedAttributes = ['h', 't', 'w', 'x', 'y'];
	const objAttributes = Object.keys(obj);
	return JSON.stringify(objAttributes.sort()) === JSON.stringify(allowedAttributes.sort());
}

function removeDuplicateStringsFromObject(obj) {
	for (let key in obj) {
		if (typeof obj[key] === 'string') {
			let words = obj[key].split(' ');
			let uniqueWords = [...new Set(words)];
			obj[key] = uniqueWords.join(' ').trim();
		}
	}
	return obj;
}

function extractDomain(url: string): string {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname;
	} catch (e) {
		return '';
	}
}


 export function pruneDomList(x, url) {
	
	for (var i = 0; i < x.length; i++) {

		if (typeof x[i] == 'string') {
			x[i] = JSON5.parse(x[i]);
		}

		// sometimes the string is double parsed. both the array was parsed and then the element objects were parsed again

		if (typeof x[i] == 'string') {
			x[i] = JSON5.parse(x[i]);
		}

		delete x[i].isIframe;
		delete x[i].iframePosition;
		x[i].w = x[i].width;
		delete x[i].width;
		x[i].h = x[i].height;
		delete x[i].height;
		x[i].t = x[i].tagName;
		delete x[i].tagName;

		// delete x[i].x;
		// delete x[i].y;

		if(typeof x[i].interactivity != 'undefined') {
			x[i].k = x[i].interactivity[0];
			delete x[i].interactivity;

			if (x[i].k == 'clickable') {
				x[i].k = 1;
			} else {
				x[i].k = 0;
			}

		}

		delete x[i].k;
		delete x[i].i;
		
		

		//x[i].x = parseInt(x[i].x);
		//x[i].y = parseInt(x[i].y);
		//x[i].w = parseInt(x[i].w);
		//x[i].h = parseInt(x[i].h);
		delete x[i].inputType;

		x[i].c = x[i].class;
		delete x[i].class;
		if(typeof x[i].c != 'string') {
			delete x[i].c;
		}

		x[i].tx = x[i].text;
		delete x[i].text;
		
		
		if (typeof x[i].href !== 'undefined' && x[i].href !== null) {
			// Handle email links
			if (!x[i].href.startsWith('mailto:')) {
				// Handle tel: links
				if (!x[i].href.startsWith('tel:')) {
					
					// Handle dot links
					if (!x[i].href.includes('.')) {

						// Handle javascript: links
						if (x[i].href.startsWith('javascript:')) {
							delete x[i].href;
						} else {
							// Handle anchor links
							if (x[i].href.startsWith('#')) {
								x[i].href = url + x[i].href;
							} else {
								var domain = extractDomain(url);
								// If href doesn't start with http/https and doesn't include the domain
								if (!x[i].href.startsWith('http') && !x[i].href.includes(domain)) {
									// If href starts with /, append to domain
									if (x[i].href.startsWith('/')) {
										x[i].href = domain + x[i].href;
									} else {
										// Otherwise append with / to domain
										x[i].href = domain + '/' + x[i].href;
									}
								}
							}
						}
					}
				}
			}
		}


		if(typeof x[i].src != 'undefined' && x[i].src != null) {
			
			x[i].src = x[i].src.replace('https://www.', '').replace('https://', '');
		}

		if (typeof x[i].href != 'undefined' && x[i].href != null) {
			x[i].href = x[i].href.replace('https://www.', '').replace('https://', '');
		}

		// loop through all the variables. any variable that has an empty value should be deleted
		Object.keys(x[i]).forEach(function(key,index) {
			if(x[i][key] == '') {
				delete x[i][key];
			}
		});

		//x[i].i = i;


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
        if (hasOnlySpecifiedAttributes(x[i])) {
			delete x[i];
		} 

		// if(x[i].t !== "BUTTON" && x[i].t !== "A" && x[i].t !== "IMG") {
		// 	delete x[i];
		// }	
	}

    x = removeDuplicateStringsFromObject(x);

	x = x.filter(e => e !== null);

	return x;

}