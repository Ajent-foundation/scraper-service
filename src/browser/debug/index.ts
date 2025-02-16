import { Page } from 'puppeteer';
import { simplifyDOM } from '../../webFuncs/simplifyDOM';

async function setMouseDebugger(page:Page) {
	await page.evaluateOnNewDocument(() => {
		// Install mouse helper only for top-level frame.
		if (window !== window.parent) return;
		window.addEventListener(
			'DOMContentLoaded',
			() => {
				let moveTimer: string | number | NodeJS.Timeout; // Timer to track mouse movement

				const box = document.createElement('puppeteer-mouse-pointer');
				const coords = document.createElement('div');
				const styleElement = document.createElement('style');
				styleElement.innerHTML = `
					puppeteer-mouse-pointer {
						pointer-events: none;
						position: absolute;
						top: 0;
						z-index: 10000;
						left: 0;
						width: 20px;
						height: 20px;
						background: rgba(0,0,0,.4);
						border: 1px solid white;
						border-radius: 10px;
						margin: -10px 0 0 -10px;
						padding: 0;
						transition: background .2s, border-radius .2s, border-color .2s;
					}
					puppeteer-mouse-pointer.button-1 {
						transition: none;
						background: rgba(0,0,0,0.9);
					}
					puppeteer-mouse-pointer.button-2 {
						transition: none;
						border-color: rgba(0,0,255,0.9);
					}
					puppeteer-mouse-pointer.button-3 {
						transition: none;
						border-radius: 4px;
					}
					puppeteer-mouse-pointer.button-4 {
						transition: none;
						border-color: rgba(255,0,0,0.9);
					}
					puppeteer-mouse-pointer.button-5 {
						transition: none;
						border-color: rgba(0,255,0,0.9);
					}
					div.coords { /* Styling for the coordinates div */
						position: absolute;
						top: 0;
						left: 0;
						color: white;
						font-size: 10px;
						z-index: 10001;
						pointer-events: none; /* Ensure it doesn't interfere with mouse events */
						background: rgba(0, 0, 0, 0.7); /* Semi-transparent background */
						border-radius: 4px;
						padding: 2px 4px;
						margin: 20px 0 0 -10px; /* Adjust to not overlap with the box */
					}
				`;

				document.head.appendChild(styleElement);
				document.body.appendChild(box);
				coords.classList.add('coords');
				document.body.appendChild(coords);

				document.addEventListener(
					'mousemove',
					(event) => {
						clearTimeout(moveTimer);
						box.style.left = event.pageX + 'px';
						box.style.top = event.pageY + 'px';
						coords.style.left = event.pageX + 'px';
						coords.style.top = event.pageY + 0 + 'px';

						// Set a timer that will update coordinates after the mouse stops moving for 100ms
						moveTimer = setTimeout(() => {
							coords.textContent = `X: ${event.pageX}, Y: ${event.pageY}`;
						}, 100);
					},
					true,
				);

				document.addEventListener(
					'mousedown',
					(event) => {
						updateButtons(event.buttons);
						box.classList.add('button-' + event.which);
					},
					true,
				);

				document.addEventListener(
					'mouseup',
					(event) => {
						updateButtons(event.buttons);
						box.classList.remove('button-' + event.which);
					},
					true,
				);

				function updateButtons(buttons) {
					for (let i = 0; i < 5; i++) {
						box.classList.toggle(
							'button-' + (i + 1),
							//@ts-ignore
							buttons & (1 << i),
						);
					}
				}
			},
			false,
		);
	});
}

async function attachFloatingButtons(page){
	await page.evaluateOnNewDocument(() => {
		const buttonTemplate = document.createElement('button');
		buttonTemplate.style.width = '20px';
		buttonTemplate.style.height = '20px';
		buttonTemplate.style.color = 'white';
		buttonTemplate.style.border = 'none';
		buttonTemplate.style.borderRadius = '50%'; 
		buttonTemplate.style.cursor = 'pointer';
		buttonTemplate.style.display = 'flex';
		buttonTemplate.style.alignItems = 'center';
		buttonTemplate.style.justifyContent = 'center';

		const floatingButtons = document.createElement('div');
		floatingButtons.innerHTML = `
			<div id="overlay-debuggers" style="position: fixed; top: 0px; left: 5px; z-index: 10000;">
				<div
					style="
						overflow: hidden;
						width: 40px;
						min-height: 10px;
						background-color: #3498DB;
						border-radius: 0 0 5px 5px;
						transition:min-height 0.3s ease;
						padding: 5px;
					"
				>
					<div id="overlay-debug-buttons" style="overflow:hidden;width:100%;height:0px;display:flex;align-items:center;justify-content:center;flex-direction:column;transition:height 0.3s ease;">
						
					</div>
				</div>
			</div>
		`;

		floatingButtons.onmouseenter = ()=>{
			document.getElementById("overlay-debug-buttons").style.height = "100%";
		}
		floatingButtons.onmouseleave = ()=>{
			document.getElementById("overlay-debug-buttons").style.height = "0px";
		}

		// replace if existent
		const overlayDebuggers = document.getElementById('overlay-debuggers');
		if(overlayDebuggers){
			overlayDebuggers.remove();
		}

		document.body.appendChild(floatingButtons);
		const buttonsToInsert = []
		//const button_a = buttonTemplate.cloneNode(true) as HTMLButtonElement;

		// Insert buttons
		const overlayDebugButtons = document.getElementById('overlay-debug-buttons');
		buttonsToInsert.map((button)=>{
			overlayDebugButtons.appendChild(button);
		})
	});
}


export async function overrideContextMenu(page: Page) {
	await page.evaluateOnNewDocument(() => {
		// Create the custom context menu container
		const contextMenu = document.createElement('div');
		contextMenu.id = 'custom-context-menu';
		contextMenu.style.display = 'none';
		contextMenu.style.position = 'absolute';
		contextMenu.style.background = 'white';
		contextMenu.style.border = '1px solid #ccc';
		contextMenu.style.zIndex = '1000';

		// Create the unordered list
		const ul = document.createElement('ul');
		ul.style.listStyle = 'none';
		ul.style.padding = '10px';
		ul.style.margin = '0';

		// Create the list item
		const li = document.createElement('li');
		li.id = 'custom-option';
		li.textContent = 'Custom Option';
		li.style.padding = '5px 10px';
		li.style.cursor = 'pointer';

		// Add hover effect to the list item
		li.addEventListener('mouseover', () => {
			li.style.background = '#eee';
		});
		li.addEventListener('mouseout', () => {
			li.style.background = 'white';
		});

		// Append the list item to the unordered list
		ul.appendChild(li);

		// Append the unordered list to the context menu container
		contextMenu.appendChild(ul);

		// Append the context menu container to the document body
		document.body.appendChild(contextMenu);

		// Event listener to show the custom context menu
		document.addEventListener('contextmenu', (event) => {
			event.preventDefault();

			contextMenu.style.display = 'block';
			contextMenu.style.left = `${event.pageX}px`;
			contextMenu.style.top = `${event.pageY}px`;
		});

		// Event listener to hide the custom context menu
		document.addEventListener('click', () => {
			contextMenu.style.display = 'none';
		});

		// Event listener for the custom option
		li.addEventListener('click', () => {
			// Prompt the user for input
			const input = prompt('Please enter codeNumber');
			if(input === "1") {
				const fullPageBBox = {
					x: 0,
					y: 0,
					width: document.documentElement.scrollWidth,
					height: document.documentElement.scrollHeight,
				}
			
				const elms = simplifyDOM(fullPageBBox)
				elms

				// // Draw Red border around the elements
				// elms.forEach((elm) => {
				// 	const div = document.createElement('div');
				// 	div.style.position = 'absolute';
				// 	div.style.border = '2px solid red';
				// 	div.style.left = `${elm.x}px`;
				// 	div.style.top = `${elm.y}px`;
				// 	div.style.width = `${elm.width}px`;
				// 	div.style.height = `${elm.height}px`;
				// 	document.body.appendChild(div);
				// });
			}
		});
	});
}

export async function attachDebuggers(page: Page) {
	await setMouseDebugger(page);
	// await overrideContextMenu(page);
	// await attachFloatingButtons(page)
}
