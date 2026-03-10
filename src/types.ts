import type { App, CachedMetadata, TFile } from "obsidian";
import type { Request, Response, NextFunction } from "express";

// Error codes: first 3 digits = HTTP status, last 2 = sub-code
export enum ErrorCode {
  // 400 - Bad Request
  TextContentEncodingRequired = 40000,
  ContentTypeSpecificationRequired = 40001,
  InvalidContentType = 40002,
  InvalidContentForOperation = 40003,
  InvalidPatchParameters = 40004,
  InvalidTargetType = 40005,
  InvalidOperation = 40006,
  InvalidSearchQuery = 40007,
  MissingRequiredField = 40008,

  // 401 - Unauthorized
  ApiKeyAuthorizationRequired = 40100,

  // 404 - Not Found
  FileNotFound = 40400,
  DirectoryNotFound = 40401,
  ActiveFileNotFound = 40402,
  CommandNotFound = 40403,
  PeriodicNoteNotFound = 40404,
  TargetNotFound = 40405,
  PeriodNotConfigured = 40406,

  // 405 - Method Not Allowed
  RequestMethodValidOnlyForFiles = 40500,

  // 409 - Conflict
  ContentAlreadyExists = 40900,

  // 500 - Server Error
  InternalError = 50000,
  PatchFailed = 50001,
  SearchFailed = 50002,
  CommandExecutionFailed = 50003,
  CertificateError = 50004,
}

export interface PluginSettings {
  apiKey: string;
  port: number;
  insecurePort: number;
  enableInsecureServer: boolean;
  enableSecureServer: boolean;
  bindingHost: string;
  corsOrigin: string;
  subjectAltNames: string;
  crypto: {
    cert: string;
    privateKey: string;
    publicKey: string;
  } | null;
}

export interface HandlerContext {
  app: App;
  settings: PluginSettings;
  manifest: Record<string, unknown>;
  metadata: MetadataServiceInterface;
  resolver: FileResolverServiceInterface;
  respond: ResponseServiceInterface;
}

export interface MetadataServiceInterface {
  getFileMetadata(file: TFile): Promise<FileMetadataObject>;
  getDocumentMap(cache: CachedMetadata | null): DocumentMapObject;
  waitForFileCache(file: TFile, timeoutMs?: number): Promise<CachedMetadata | null>;
}

export interface FileResolverServiceInterface {
  resolve(nameOrPath: string): TFile | null;
  resolveOrThrow(nameOrPath: string): TFile;
}

export interface ResponseServiceInterface {
  sendSuccess(res: Response, data: unknown, status?: number): void;
  sendError(res: Response, errorCode: ErrorCode, message?: string, details?: Record<string, unknown>): void;
  sendFile(res: Response, content: string | ArrayBuffer, contentType: string): void;
}

export interface FileMetadataObject {
  path: string;
  tags: string[];
  frontmatter: Record<string, unknown>;
  stat: {
    ctime: number;
    mtime: number;
    size: number;
  };
  content?: string;
}

export interface DocumentMapObject {
  headings: string[];
  blocks: string[];
  frontmatterFields: string[];
}

export type PatchTargetType = "heading" | "block" | "frontmatter";
export type PatchOperation = "append" | "prepend" | "replace";

export interface PatchParams {
  operation: PatchOperation;
  targetType: PatchTargetType;
  target: string;
  content: string;
  targetDelimiter: string;
  createTargetIfMissing: boolean;
  trimTargetWhitespace: boolean;
}

export interface PatchErrorDetails {
  availableTargets?: string[];
  targetRequested?: string;
  documentMap?: DocumentMapObject;
}

export interface SearchResponseItem {
  filename: string;
  score?: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  match: { start: number; end: number };
  context: string;
}

export interface SearchJsonResponseItem {
  filename: string;
  result: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly errorCode: ErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
