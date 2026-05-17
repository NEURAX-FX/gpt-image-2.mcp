import type { ImageContent, TextContent } from "@modelcontextprotocol/sdk/types.js";

export type ImageReturnMode = "image" | "file" | "both";

export interface ImageArgsWithReturn {
  file?: string;
  return?: ImageReturnMode;
}

export interface ImageResultItem {
  data: string;
  mimeType: string;
}

export interface BuildImageToolContentArgs {
  operation: "generate" | "edit";
  returnMode: ImageReturnMode;
  images: ImageResultItem[];
  paths: string[];
  note?: string;
}

export function resolveImageReturnMode(args: ImageArgsWithReturn): ImageReturnMode {
  if (args.return) return args.return;
  return args.file ? "file" : "image";
}

export function mimeTypeForFormat(format: string | undefined): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}

export function buildImageToolContent({
  operation,
  returnMode,
  images,
  paths,
  note,
}: BuildImageToolContentArgs): Array<TextContent | ImageContent> {
  const content: Array<TextContent | ImageContent> = [];

  if (returnMode === "file" || returnMode === "both") {
    const verb = operation === "generate" ? "Generated" : "Wrote";
    const text = `${note ? note + "\n" : ""}${verb} ${paths.length} image(s):\n${paths.join("\n")}`;
    content.push({ type: "text", text });
  }

  if (returnMode === "image" || returnMode === "both") {
    content.push(
      ...images.map((image) => ({
        type: "image" as const,
        data: image.data,
        mimeType: image.mimeType,
      })),
    );
  }

  return content;
}
