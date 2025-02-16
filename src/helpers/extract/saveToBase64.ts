import { promises as fs } from 'fs';

// Function to convert base64 string to an image and save it
export async function saveBase64Image(base64String: string, filePath: string): Promise<void> {
    // Remove the data URL part if it exists
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');

    // Decode the base64 string
    const buffer = Buffer.from(base64Data, 'base64');

    // Write the decoded image to a file
    await fs.writeFile(filePath, buffer);
}