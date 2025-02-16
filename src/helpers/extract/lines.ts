import Jimp from 'jimp';

export async function drawPercentageLines(base64String: string): Promise<string> {
    // Decode the base64 string to a buffer
    const buffer = Buffer.from(base64String, 'base64');
    
    // Open the image from the buffer
    const image = await Jimp.read(buffer);
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    // Load the larger font
    let font;
    try {
        font = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
    } catch (e) {
        console.error("Error loading font:", e);
        return "";
    }

    // Define line thickness
    const lineThickness = 3; // Adjust this value to make lines thicker

    // Draw lines and labels every 10% of the height
    for (let i = 1; i < 10; i++) {
        const y = Math.floor(height * (i / 10));
        
        // Draw thicker lines
        for (let t = 0; t < lineThickness; t++) {
            image.scan(0, y + t, width, 1, function (x, y, idx) {
                this.bitmap.data[idx + 0] = 255; // Red
                this.bitmap.data[idx + 1] = 0;   // Green
                this.bitmap.data[idx + 2] = 0;   // Blue
                this.bitmap.data[idx + 3] = 255; // Alpha
            });
        }

        const label = `${i * 10}%`;
        const textWidth = Jimp.measureText(font, label);
        const textHeight = Jimp.measureTextHeight(font, label, width);
        
        // Draw a white rectangle behind the text for visibility
        image.print(font, 5, y - textHeight / 2, {
            text: '',
            alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }, textWidth, textHeight, (err, image, { x, y }) => {
            if (err) throw err;
            image
                .scan(x, y, textWidth, textHeight, function (x, y, idx) {
                    this.bitmap.data[idx + 0] = 255; // Red
                    this.bitmap.data[idx + 1] = 255; // Green
                    this.bitmap.data[idx + 2] = 255; // Blue
                    this.bitmap.data[idx + 3] = 255; // Alpha
                })
                .print(font, 5, y - textHeight / 2, label, undefined, undefined, (err, image) => {
                    if (err) throw err;
                    image
                        .scan(x, y, textWidth, textHeight, function (x, y, idx) {
                            this.bitmap.data[idx + 0] = 255; // Red
                            this.bitmap.data[idx + 1] = 0;   // Green
                            this.bitmap.data[idx + 2] = 0;   // Blue
                            this.bitmap.data[idx + 3] = 255; // Alpha
                        });
                });
        });
    }

    // Get the base64 string of the modified image
    const outputBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
    const outputBase64 = outputBuffer.toString('base64');
    
    return outputBase64;
}