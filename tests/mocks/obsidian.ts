import { vi } from "vitest";

export interface MockTFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  stat: { ctime: number; mtime: number; size: number };
}

export function createMockFile(path: string, content = ""): MockTFile {
  const parts = path.split("/");
  const name = parts[parts.length - 1];
  const basename = name.replace(/\.[^.]+$/, "");
  const extension = name.includes(".") ? name.split(".").pop()! : "";

  return {
    path,
    name,
    basename,
    extension,
    stat: { ctime: Date.now(), mtime: Date.now(), size: content.length },
  };
}

export function createMockApp(files: Record<string, string> = {}) {
  const fileStore = new Map(Object.entries(files));
  const mockFiles = Object.keys(files).map((p) => createMockFile(p, files[p]));

  const vault = {
    getFiles: vi.fn(() => mockFiles),
    getMarkdownFiles: vi.fn(() => mockFiles.filter((f) => f.extension === "md")),
    getFileByPath: vi.fn((path: string) => mockFiles.find((f) => f.path === path) ?? null),
    getAbstractFileByPath: vi.fn((path: string) => mockFiles.find((f) => f.path === path) ?? null),
    cachedRead: vi.fn(async (file: MockTFile) => fileStore.get(file.path) ?? ""),
    read: vi.fn(async (file: MockTFile) => fileStore.get(file.path) ?? ""),
    modify: vi.fn(async (file: MockTFile, content: string) => {
      fileStore.set(file.path, content);
    }),
    create: vi.fn(async (path: string, content: string) => {
      fileStore.set(path, content);
      const newFile = createMockFile(path, content);
      mockFiles.push(newFile);
      return newFile;
    }),
    createFolder: vi.fn(async () => {}),
    delete: vi.fn(async (file: MockTFile) => {
      fileStore.delete(file.path);
      const idx = mockFiles.findIndex((f) => f.path === file.path);
      if (idx !== -1) mockFiles.splice(idx, 1);
    }),
    adapter: { write: vi.fn() },
  };

  const metadataCache = {
    getFileCache: vi.fn((_file: MockTFile) => null as any),
    on: vi.fn(() => ({ id: "mock" })),
    offref: vi.fn(),
  };

  const workspace = {
    getActiveFile: vi.fn(() => null as MockTFile | null),
    openLinkText: vi.fn(async () => {}),
  };

  const fileManager = {
    processFrontMatter: vi.fn(
      async (file: MockTFile, fn: (frontmatter: Record<string, unknown>) => void) => {
        const content = fileStore.get(file.path) ?? "";
        const frontmatter: Record<string, unknown> = {};

        // Parse existing frontmatter
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          for (const line of fmMatch[1].split("\n")) {
            const [key, ...rest] = line.split(": ");
            if (key && rest.length > 0) {
              frontmatter[key.trim()] = rest.join(": ").trim();
            }
          }
        }

        fn(frontmatter);

        // Rebuild content
        const fmLines = Object.entries(frontmatter)
          .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
          .join("\n");
        const body = fmMatch ? content.slice(fmMatch[0].length) : "\n" + content;
        fileStore.set(file.path, `---\n${fmLines}\n---${body}`);
      },
    ),
  };

  const commands = {
    commands: {} as Record<string, { id: string; name: string }>,
    executeCommandById: vi.fn(async () => {}),
  };

  return {
    vault,
    metadataCache,
    workspace,
    fileManager,
    commands,
    plugins: { plugins: {} },
    _fileStore: fileStore,
  };
}
