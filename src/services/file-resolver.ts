import type { App, TFile } from "obsidian";
import { ErrorCode, type FileResolverServiceInterface } from "../types";

export class FileResolverService implements FileResolverServiceInterface {
  constructor(private app: App) {}

  resolve(nameOrPath: string): TFile | null {
    // Try exact path first
    const byPath = this.app.vault.getFileByPath(nameOrPath);
    if (byPath) return byPath;

    // Try wikilink-style resolution (name without extension)
    const files = this.app.vault.getFiles();
    const normalized = nameOrPath.toLowerCase();

    for (const file of files) {
      if (file.path.toLowerCase() === normalized) return file;
      if (file.basename.toLowerCase() === normalized) return file;
      if (file.name.toLowerCase() === normalized) return file;
    }

    return null;
  }

  resolveOrThrow(nameOrPath: string): TFile {
    const file = this.resolve(nameOrPath);
    if (!file) {
      const err = new Error(`File not found: ${nameOrPath}`);
      (err as any).errorCode = ErrorCode.FileNotFound;
      throw err;
    }
    return file;
  }
}
