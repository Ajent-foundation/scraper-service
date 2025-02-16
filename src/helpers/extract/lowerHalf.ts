import { createCanvas, loadImage } from 'canvas';

/**
 * Slices the base64 image horizontally and returns the base64 string of the lower half.
 * @param base64Data - The raw base64 string of the image without the header.
 * @returns The base64 string of the lower half of the image.
 */
export async function sliceBase64Image(base64Data: string): Promise<{ upperHalfBase64: string, lowerHalfBase64: string }> {
    const start = Date.now();
  
    // Convert the base64 string to a buffer
    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`Buffer creation time: ${Date.now() - start}ms`);
  
    // Load the image
    const image = await loadImage(buffer);
    console.log(`Image loading time: ${Date.now() - start}ms`);
  
    // Create canvases for both halves and get the contexts
    const canvasUpper = createCanvas(image.width, image.height / 2);
    const ctxUpper = canvasUpper.getContext('2d');
  
    const canvasLower = createCanvas(image.width, image.height / 2);
    const ctxLower = canvasLower.getContext('2d');
    console.log(`Canvas creation time: ${Date.now() - start}ms`);
  
    // Draw the upper half of the image onto the upper canvas
    ctxUpper.drawImage(image, 0, 0, image.width, image.height / 2, 0, 0, image.width, image.height / 2);
    console.log(`Upper half drawing time: ${Date.now() - start}ms`);
  
    // Draw the lower half of the image onto the lower canvas
    ctxLower.drawImage(image, 0, -image.height / 2);
    console.log(`Lower half drawing time: ${Date.now() - start}ms`);
  
    // Get the base64 strings of the upper and lower halves of the image
    const upperHalfBase64 = canvasUpper.toDataURL().replace(/^data:image\/\w+;base64,/, '');
    const lowerHalfBase64 = canvasLower.toDataURL().replace(/^data:image\/\w+;base64,/, '');
    console.log(`Encoding time: ${Date.now() - start}ms`);
  
    return { upperHalfBase64, lowerHalfBase64 };
  }
  

// Example usage: