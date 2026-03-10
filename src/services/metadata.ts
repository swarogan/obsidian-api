import type { App, CachedMetadata, TFile } from "obsidian";
import type { FileMetadataObject, DocumentMapObject, MetadataServiceInterface } from "../types";

export class MetadataService implements MetadataServiceInterface {
  constructor(private app: App) {}

  async getFileMetadata(file: TFile): Promise<FileMetadataObject> {
    const cache = await this.waitForFileCache(file);
    const content = await this.app.vault.cachedRead(file);

    const tags = this.extractTags(cache);

    return {
      path: file.path,
      tags,
      frontmatter: cache?.frontmatter ? { ...cache.frontmatter } : {},
      stat: {
        ctime: file.stat.ctime,
        mtime: file.stat.mtime,
        size: file.stat.size,
      },
      content,
    };
  }

  getDocumentMap(cache: CachedMetadata | null): DocumentMapObject {
    return MetadataService.buildDocumentMap(cache);
  }

  static buildDocumentMap(cache: CachedMetadata | null): DocumentMapObject {
    const headings = (cache?.headings ?? []).map(
      (h) => `${"#".repeat(h.level)} ${h.heading}`
    );
    const blocks = Object.keys(cache?.blocks ?? {});
    const frontmatterFields = Object.keys(cache?.frontmatter ?? {}).filter(
      (k) => k !== "position"
    );

    return { headings, blocks, frontmatterFields };
  }

  waitForFileCache(
    file: TFile,
    timeoutMs = 5000,
  ): Promise<CachedMetadata | null> {
    return new Promise((resolve) => {
      const existing = this.app.metadataCache.getFileCache(file);
      if (existing) {
        resolve(existing);
        return;
      }

      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, timeoutMs);

      const ref = this.app.metadataCache.on("changed", (changedFile) => {
        if (changedFile.path === file.path && !resolved) {
          resolved = true;
          clearTimeout(timer);
          this.app.metadataCache.offref(ref);
          resolve(this.app.metadataCache.getFileCache(file));
        }
      });
    });
  }

  private extractTags(cache: CachedMetadata | null): string[] {
    const tagSet = new Set<string>();

    const frontmatterTags = cache?.frontmatter?.tags;
    if (Array.isArray(frontmatterTags)) {
      for (const t of frontmatterTags) {
        if (t) tagSet.add(String(t));
      }
    } else if (typeof frontmatterTags === "string" && frontmatterTags) {
      tagSet.add(frontmatterTags);
    }

    const inlineTags = cache?.tags ?? [];
    for (const t of inlineTags) {
      tagSet.add(t.tag.replace(/^#/, ""));
    }

    return [...tagSet];
  }
}
