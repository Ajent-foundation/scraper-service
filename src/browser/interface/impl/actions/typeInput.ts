import { Page } from 'puppeteer';
import { GhostCursor } from 'ghost-cursor';
import { setMousePosition } from '../../ghostCursor';

export interface IBody {
	x: number;
	y: number;
	input: string;
}

export default async function execute(
	page: Page,
	cursor: GhostCursor,
	body: IBody,
) {
	// Move to the element
	if (cursor) {
		await cursor.moveTo({ x: body.x, y: body.y });

		const pos = cursor.getLocation();
		await setMousePosition(page, pos.x, pos.y);
	} else {
		await page.mouse.move(body.x, body.y);
	}

	// Click the element to focus
	await page.mouse.click(body.x, body.y, {
		clickCount: 1,
		delay: 50,
		button: 'left',
	});

	// delay
	await (async (delay) =>
		new Promise((resolve) => setTimeout(resolve, delay)))(100);

	// Check if the element is an input, textarea, or contenteditable
	const elementType = await page.evaluate(
		({ x, y }) => {
			const element = document.elementFromPoint(x, y);
			if (element instanceof HTMLElement) {
				console.log(element);
				const isEditable = element.isContentEditable;
				const isInputOrTextarea =
					element.tagName === 'INPUT' ||
					element.tagName === 'TEXTAREA';
				// const hasText = element.textContent.length > 0;
				let hasText = false;
				if (isInputOrTextarea) {
					const inputElement = element as
						| HTMLInputElement
						| HTMLTextAreaElement;
					hasText = inputElement.value.length > 0;
				}
				return { isEditable, isInputOrTextarea, hasText };
			}
			return {
				isEditable: false,
				isInputOrTextarea: false,
				hasText: false,
			};
		},
		{ x: body.x, y: body.y },
	);

	console.log(elementType);

	if (elementType.isInputOrTextarea) {
		if (elementType.hasText) {
			// Select all text inside the input field or contenteditable element
			await page.keyboard.down('Control'); // Use 'Command' for macOS
			await page.keyboard.press('A'); // 'A' to select all
			await page.keyboard.up('Control'); // Release 'Control' key

			// Clear the selected text
			await page.keyboard.press('Backspace');
		}

		// Type the new input
		// await page.keyboard.type(command.input, { delay: 100 })
	} else {
		console.log(
			'The targeted element is not an input, textarea, or contenteditable element.',
		);
		// Type the new input
		// await page.keyboard.type(command.input, { delay: 100 })
	}

	let input = body.input;

	let enterKey = false;
	if (input.includes('[ENTER]')) {
		input = input.replace('[ENTER]', '');
		enterKey = true;
	}

	var tabKey = false;
	if (input.includes('[TAB]')) {
		input = input.replace('[TAB]', '');
		tabKey = true;
	}

	var backspaceKey = false;
	if (input.includes('[BACKSPACE]')) {
		input = input.replace('[BACKSPACE]', '');
		backspaceKey = true;
	}

	console.log("input:", input);

	// Type the new input
	// Handle double escaped newlines and split input by newlines
	const processedInput = input.includes('\\\\n') ? input.replace(/\\\\n/g, '\n') : input;
	const lines = processedInput.split('\n');
	for (let i = 0; i < lines.length; i++) {
		await page.keyboard.type(lines[i], { delay: 100 });
		if (i < lines.length - 1) {
			await page.keyboard.press('Enter');
		}
	}

	if (enterKey) {
		await page.keyboard.press('Enter');
	}

	if (tabKey) {
		await page.keyboard.press('Tab');
	}

	if (backspaceKey) {
		await page.keyboard.press('Backspace');
	}

	// delay
	await (async (delay) =>
		new Promise((resolve) => setTimeout(resolve, delay)))(400);

	return {};
}
