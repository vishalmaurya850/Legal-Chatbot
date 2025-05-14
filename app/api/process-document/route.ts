import { NextResponse } from "next/server";
import { processDocument } from "@/lib/document-service";

export async function POST(req: Request) {
  try {
    const { filePath, fileName, fileType, fileSize, userId, extractedText } = await req.json();
    console.log("POST /api/process-document received:", { filePath, fileName, fileType, fileSize, userId, hasExtractedText: !!extractedText });

    if (!filePath || !fileName || !fileType || !fileSize || !userId) {
      console.error("Missing required fields");
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await processDocument(filePath, fileName, fileType, fileSize, userId, true, extractedText);
    if (!result.success) {
      console.error("Document processing failed:", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log("Document processed successfully, documentId:", result.documentId);
    return NextResponse.json({ documentId: result.documentId }, { status: 200 });
  } catch (error: any) {
    console.error("Error in process-document API:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      {
        error: error.message || "Failed to process document",
        details: {
          name: error.name,
          stack: error.stack,
        },
      },
      { status: 500 }
    );
  }
}