export async function recognizeImage(file: File): Promise<string> {
  console.log("recognizeImage called for file:", file.name);
  try {
    const tesseract = await import("node-tesseract-ocr");
    console.log("node-tesseract-ocr imported successfully");
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await tesseract.recognize(buffer, {
      lang: "eng",
      oem: 1,
      psm: 3,
      // Uncomment if Tesseract binary path is needed on Windows
      // tesseractPath: "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
    });
    return text;
  } catch (error: any) {
    console.error("Error in server-side OCR:", JSON.stringify(error, null, 2));
    throw new Error(`Server-side OCR failed: ${error.message || "Unknown error"}`);
  }
}