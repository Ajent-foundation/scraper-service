import * as fs from 'fs';

export function saveBase64Image(base64String: string, filePath: string) {
    // Remove the data URL part if it exists
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    fs.writeFile(filePath, buffer, (err) => {
        if (err) {
            console.error('Error saving the image:', err);
        } else {
            console.log('Image saved successfully to', filePath);
        }
    });
}