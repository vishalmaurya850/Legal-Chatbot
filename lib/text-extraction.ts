import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";

// Supported MIME types (aligned with document-service.ts and storage-service.ts)
const SUPPORTED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

// Set PDF.js worker source (client-side only, server uses synchronous processing)
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "../pdf.worker.mjs";
}

interface TextExtractionResult {
  success: boolean;
  text?: string;
  error?: string;
}

interface PdfTextContentItem {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
  dir?: string;
  fontName?: string;
}

/**
 * Extract text from a file based on its MIME type
 * @param file The file to extract text from
 * @returns TextExtractionResult with extracted text or error
 */
export async function extractTextFromFile(file: File): Promise<TextExtractionResult> {
  console.log("extractTextFromFile called with file:", file.name, file.type);
  const fileType = file.type;

  if (!SUPPORTED_DOCUMENT_TYPES.includes(fileType)) {
    const error = `Unsupported file type for text extraction: ${fileType}`;
    console.error(error);
    return { success: false, error };
  }

  try {
    if (fileType === "application/pdf") {
      return await extractTextFromPdf(file);
    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileType === "application/msword"
    ) {
      return await extractTextFromWord(file);
    } else if (fileType === "text/plain") {
      return await extractTextFromTxt(file);
    } else if (fileType === "image/png" || fileType === "image/jpeg" || fileType === "image/jpg") {
      return await extractTextFromImage(file);
    } else {
      return { success: false, error: `Unexpected file type: ${fileType}` };
    }
  } catch (error: any) {
    const errorMessage = `Error extracting text from file (${file.name}): ${error.message || "Unknown error"}`;
    console.error(errorMessage, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Extract text from a PDF file
 */
async function extractTextFromPdf(file: File): Promise<TextExtractionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts: string[] = [];

    const pagePromises = Array.from({ length: pdf.numPages }, async (_, i) => {
      const page = await pdf.getPage(i + 1);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: PdfTextContentItem) => item.str)
        .filter((str) => str.trim().length > 0)
        .join(" ");
      return pageText;
    });

    const pageTexts = await Promise.all(pagePromises);
    const text = pageTexts.join("\n\n");

    if (!text.trim()) {
      return { success: false, error: "No text content found in PDF" };
    }

    return { success: true, text };
  } catch (error: any) {
    const errorMessage = `Error extracting text from PDF (${file.name}): ${error.message || "Unknown error"}`;
    console.error(errorMessage, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Extract text from a Word document
 */
async function extractTextFromWord(file: File): Promise<TextExtractionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value.trim();

    if (!text) {
      return { success: false, error: "No text content found in Word document" };
    }

    return { success: true, text };
  } catch (error: any) {
    const errorMessage = `Error extracting text from Word document (${file.name}): ${error.message || "Unknown error"}`;
    console.error(errorMessage, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Extract text from a plain text file
 */
async function extractTextFromTxt(file: File): Promise<TextExtractionResult> {
  try {
    const text = await file.text();
    if (!text.trim()) {
      return { success: false, error: "No text content found in text file" };
    }

    return { success: true, text };
  } catch (error: any) {
    const errorMessage = `Error extracting text from text file (${file.name}): ${error.message || "Unknown error"}`;
    console.error(errorMessage, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Extract text from an image file using tesseract.js (client) or node-tesseract-ocr (server)
 */
async function extractTextFromImage(file: File): Promise<TextExtractionResult> {
  try {
    console.log("extractTextFromImage: Running in", typeof window === "undefined" ? "server" : "client");
    if (typeof window !== "undefined") {
      console.log("Using tesseract.js for client-side OCR");
      const { data: { text } } = await Tesseract.recognize(file, "eng", {
        logger: (m) => console.log("OCR progress:", m),
      });
      const trimmedText = text.trim();
      if (!trimmedText) {
        return { success: false, error: "No text content found in image" };
      }
      return { success: true, text: trimmedText };
    } else {
      console.log("Importing server-side OCR module");
      const { recognizeImage } = await import("./server-ocr");
      console.log("server-ocr imported successfully");
      const text = await recognizeImage(file);
      const trimmedText = text.trim();
      if (!trimmedText) {
        return { success: false, error: "No text content found in image" };
      }
      return { success: true, text: trimmedText };
    }
  } catch (error: any) {
    const errorMessage = `Error extracting text from image (${file.name}): ${error.message || "Unknown error"}`;
    console.error(errorMessage, error);
    return { success: false, error: errorMessage };
  }
}