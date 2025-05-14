"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Paperclip, X, FileText, FileImage, FileArchive, File } from "lucide-react";
import { uploadDocument } from "@/lib/storage-service";
import { MAX_FILE_SIZE, SUPPORTED_DOCUMENT_TYPES } from "@/lib/storage-service";
import { toast } from "@/components/ui/use-toast";

interface FileUploadProps {
  userId: string;
  onUploadStart: () => void;
  onUploadComplete: (filePath: string, fileName: string, fileType: string, fileSize: number, file: File) => void;
  onUploadError: (error: string) => void;
  disabled?: boolean;
}

export function FileUpload({
  userId,
  onUploadStart,
  onUploadComplete,
  onUploadError,
  disabled = false,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
        return;
      }

      // Validate file type
      if (!SUPPORTED_DOCUMENT_TYPES.includes(file.type)) {
        setError("Unsupported file format. Please upload PDF, DOC, DOCX, TXT, PNG, JPEG, or JPG files.");
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !userId) {
      toast({
        variant: "destructive",
        description: "No file selected or user not authenticated",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    onUploadStart();

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + Math.random() * 10;
          return newProgress < 90 ? newProgress : prev;
        });
      }, 500);

      console.log("Uploading file:", selectedFile.name, "for user:", userId);

      // Upload file to Supabase Storage
      const result = await uploadDocument(selectedFile, userId);

      clearInterval(progressInterval);

      if (!result.success) {
        console.error("Upload failed:", result.error);
        throw new Error(result.error || "Failed to upload file");
      }

      console.log("Upload successful, file path:", result.filePath);
      setUploadProgress(95);

      // For now, skip the embedding generation to isolate the upload issue
      setUploadProgress(100);

      // Notify parent component with file object
      onUploadComplete(result.filePath!, selectedFile.name, selectedFile.type, selectedFile.size, selectedFile);

      // Reset state
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      toast({
        description: "File uploaded successfully!",
      });
    } catch (error: any) {
      console.error("Error uploading file:", error);
      setError(error.message || "Failed to upload file");
      onUploadError(error.message || "Failed to upload file");

      toast({
        variant: "destructive",
        description: error.message || "Failed to upload file",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.includes("pdf")) return <FileText className="h-4 w-4" />;
    if (file.type.includes("image")) return <FileImage className="h-4 w-4" />;
    if (file.type.includes("zip") || file.type.includes("rar")) return <FileArchive className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      {!selectedFile ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="border-sky-200 text-sky-700 hover:bg-sky-50"
          >
            <Paperclip className="h-4 w-4 mr-2" />
            Attach Document
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.png,.jpeg,.jpg"
            disabled={disabled || isUploading}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      ) : (
        <div className="border rounded-md p-3 bg-sky-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getFileIcon(selectedFile)}
              <div>
                <p className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            {!isUploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-6 w-6 p-0 rounded-full"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove</span>
              </Button>
            )}
          </div>

          {isUploading ? (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-gray-500">
                {uploadProgress < 95
                  ? "Uploading document..."
                  : uploadProgress < 100
                    ? "Processing document..."
                    : "Upload complete!"}
              </p>
            </div>
          ) : (
            <Button type="button" size="sm" onClick={handleUpload} className="w-full">
              Upload Document
            </Button>
          )}
        </div>
      )}
    </div>
  );
}