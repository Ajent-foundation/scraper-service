import axios from "axios"
import sharp from "sharp"

export interface IBody {
    url: string;
    quality?: number; // Percentage from 0 to 100
    resize?: number; // Percentage from 0 to 100
}

export default async function execute(body: IBody) {
    const response = await axios.post(`${body.url}/system/screenshot`, {
        quality: body.quality || 100,
    })

    // Split by first , and return 2nd part
    const img = response.data.image.split(",")[1]
    
    // If no resize specified, return original image
    if (!body.resize || body.resize === 100) {
        return {
            img: img,
        }
    }
    
    // Ensure resize is within valid range (0-100)
    const resizePercent = Math.max(0, Math.min(100, body.resize));
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(img, 'base64');
    
    // Get original image metadata
    const metadata = await sharp(imageBuffer).metadata();
    
    // Calculate new dimensions
    const newWidth = Math.round((metadata.width || 0) * (resizePercent / 100));
    const newHeight = Math.round((metadata.height || 0) * (resizePercent / 100));
    
    // Resize image
    const resizedBuffer = await sharp(imageBuffer)
        .resize(newWidth, newHeight, {
            kernel: sharp.kernel.lanczos3,
            withoutEnlargement: true
        })
        .png({ quality: 100 })
        .toBuffer();
    
    // Convert back to base64
    const resizedImg = resizedBuffer.toString('base64');
    
    return {
        img: resizedImg,
    }
}
