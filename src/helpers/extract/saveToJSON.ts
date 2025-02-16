import { writeFile } from 'fs/promises';

interface SaveJsonToFileOptions {
  filePath: string;
  data: any;
}

export async function saveJsonToFile({ filePath, data }: SaveJsonToFileOptions): Promise<void> {
  try {
    const jsonData = JSON.stringify(data, null, 2); // Convert data to JSON string with pretty print
    await writeFile(filePath, jsonData, 'utf8'); // Write JSON data to file
    console.log(`Data successfully saved to ${filePath}`);
  } catch (error) {
    console.error(`Error saving data to file: ${error}`);
    throw error;
  }
}