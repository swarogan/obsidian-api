import type { PluginSettings } from "./types";
import { ErrorCode } from "./types";

export const API_VERSION = "1";
export const CERT_NAME = "obsidian-api.crt";

export const DEFAULT_SETTINGS: PluginSettings = {
  apiKey: "",
  port: 27124,
  insecurePort: 27123,
  enableInsecureServer: false,
  enableSecureServer: true,
  bindingHost: "127.0.0.1",
  corsOrigin: "*",
  subjectAltNames: "",
  crypto: null,
};

export const CONTENT_TYPES = {
  json: "application/json",
  markdown: "text/markdown",
  noteJson: "application/vnd.olrapi.note+json",
  documentMap: "application/vnd.olrapi.document-map+json",
  jsonLogic: "application/vnd.olrapi.jsonlogic+json",
  dataviewDql: "application/vnd.olrapi.dataview.dql+txt",
} as const;

export const MAX_REQUEST_SIZE = "256mb";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.TextContentEncodingRequired]: "Text content encoding is required.",
  [ErrorCode.ContentTypeSpecificationRequired]: "Content-Type header is required.",
  [ErrorCode.InvalidContentType]: "Invalid Content-Type header.",
  [ErrorCode.InvalidContentForOperation]: "Invalid content for this operation.",
  [ErrorCode.InvalidPatchParameters]: "Invalid PATCH parameters.",
  [ErrorCode.InvalidTargetType]: "Invalid target type. Must be 'heading', 'block', or 'frontmatter'.",
  [ErrorCode.InvalidOperation]: "Invalid operation. Must be 'append', 'prepend', or 'replace'.",
  [ErrorCode.InvalidSearchQuery]: "Invalid search query.",
  [ErrorCode.MissingRequiredField]: "Missing required field.",
  [ErrorCode.ApiKeyAuthorizationRequired]: "API key authorization is required.",
  [ErrorCode.FileNotFound]: "File not found.",
  [ErrorCode.DirectoryNotFound]: "Directory not found.",
  [ErrorCode.ActiveFileNotFound]: "No active file is open.",
  [ErrorCode.CommandNotFound]: "Command not found.",
  [ErrorCode.PeriodicNoteNotFound]: "Periodic note not found.",
  [ErrorCode.TargetNotFound]: "Target not found in document.",
  [ErrorCode.PeriodNotConfigured]: "Period type is not configured.",
  [ErrorCode.RequestMethodValidOnlyForFiles]: "This request method is only valid for files, not directories.",
  [ErrorCode.ContentAlreadyExists]: "Content already exists at the target location.",
  [ErrorCode.InternalError]: "An internal error occurred.",
  [ErrorCode.PatchFailed]: "PATCH operation failed.",
  [ErrorCode.SearchFailed]: "Search operation failed.",
  [ErrorCode.CommandExecutionFailed]: "Command execution failed.",
  [ErrorCode.CertificateError]: "Certificate generation error.",
};
