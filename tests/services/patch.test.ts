import { describe, it, expect } from "vitest";
import {
  findHeadingBounds,
  findBlockBounds,
  patchContent,
} from "../../src/services/patch";
import { MetadataService } from "../../src/services/metadata";
import type { CachedMetadata, HeadingCache, Loc } from "obsidian";

function loc(line: number, col: number, offset: number): Loc {
  return { line, col, offset };
}

function heading(text: string, level: number, line: number): HeadingCache {
  return {
    heading: text,
    level,
    position: {
      start: loc(line, 0, 0),
      end: loc(line, text.length + level + 1, 0),
    },
  };
}

describe("findHeadingBounds", () => {
  const content = [
    "# Title",            // 0
    "intro text",         // 1
    "## Section A",       // 2
    "content A line 1",   // 3
    "content A line 2",   // 4
    "## Section B",       // 5
    "content B",          // 6
    "### Subsection B1",  // 7
    "sub content B1",     // 8
    "## Section C",       // 9
    "content C",          // 10
  ].join("\n");

  const cache: CachedMetadata = {
    headings: [
      heading("Title", 1, 0),
      heading("Section A", 2, 2),
      heading("Section B", 2, 5),
      heading("Subsection B1", 3, 7),
      heading("Section C", 2, 9),
    ],
  } as CachedMetadata;

  it("finds top-level heading bounds", () => {
    const bounds = findHeadingBounds(cache, ["Title"], content);
    expect(bounds).not.toBeNull();

    const extracted = content.slice(bounds!.contentStart, bounds!.contentEnd);
    // Title heading includes everything until end since it's the only level-1
    expect(extracted).toContain("intro text");
  });

  it("finds section A bounds", () => {
    const bounds = findHeadingBounds(cache, ["Section A"], content);
    expect(bounds).not.toBeNull();

    const extracted = content.slice(bounds!.contentStart, bounds!.contentEnd);
    expect(extracted).toContain("content A line 1");
    expect(extracted).toContain("content A line 2");
    expect(extracted).not.toContain("content B");
  });

  it("finds section B bounds including subsection", () => {
    const bounds = findHeadingBounds(cache, ["Section B"], content);
    expect(bounds).not.toBeNull();

    const extracted = content.slice(bounds!.contentStart, bounds!.contentEnd);
    expect(extracted).toContain("content B");
    expect(extracted).toContain("Subsection B1");
    expect(extracted).toContain("sub content B1");
    expect(extracted).not.toContain("content C");
  });

  it("finds nested heading path", () => {
    const bounds = findHeadingBounds(cache, ["Section B", "Subsection B1"], content);
    expect(bounds).not.toBeNull();

    const extracted = content.slice(bounds!.contentStart, bounds!.contentEnd);
    expect(extracted).toContain("sub content B1");
    expect(extracted).not.toContain("content B\n###");
  });

  it("returns null for non-existent heading", () => {
    const bounds = findHeadingBounds(cache, ["Nonexistent"], content);
    expect(bounds).toBeNull();
  });

  it("returns null for empty heading path", () => {
    const bounds = findHeadingBounds(cache, [], content);
    expect(bounds).toBeNull();
  });

  it("handles unicode headings", () => {
    const unicodeContent = [
      "# Główny nagłówek",
      "treść",
      "## Sekcja żółć",
      "treść sekcji",
      "## Następna",
      "treść następna",
    ].join("\n");

    const unicodeCache: CachedMetadata = {
      headings: [
        heading("Główny nagłówek", 1, 0),
        heading("Sekcja żółć", 2, 2),
        heading("Następna", 2, 4),
      ],
    } as CachedMetadata;

    const bounds = findHeadingBounds(unicodeCache, ["Sekcja żółć"], unicodeContent);
    expect(bounds).not.toBeNull();

    const extracted = unicodeContent.slice(bounds!.contentStart, bounds!.contentEnd);
    expect(extracted).toContain("treść sekcji");
    expect(extracted).not.toContain("treść następna");
  });
});

describe("findBlockBounds", () => {
  const content = [
    "Some text",               // 0
    "Block content ^block1",   // 1
    "More text",               // 2
    "Another block ^block2",   // 3
  ].join("\n");

  it("finds block by ID", () => {
    const cache: CachedMetadata = {
      blocks: {
        block1: {
          id: "block1",
          position: {
            start: loc(1, 0, 10),
            end: loc(1, 22, 32),
          },
        },
      },
    } as unknown as CachedMetadata;

    const bounds = findBlockBounds(cache, "block1", content);
    expect(bounds).not.toBeNull();

    const extracted = content.slice(bounds!.contentStart, bounds!.contentEnd);
    expect(extracted).toContain("Block content ^block1");
  });

  it("returns null for non-existent block", () => {
    const cache: CachedMetadata = {
      blocks: {},
    } as unknown as CachedMetadata;

    const bounds = findBlockBounds(cache, "nonexistent", content);
    expect(bounds).toBeNull();
  });

  it("returns null when no blocks in cache", () => {
    const cache: CachedMetadata = {} as CachedMetadata;

    const bounds = findBlockBounds(cache, "block1", content);
    expect(bounds).toBeNull();
  });
});

describe("patchContent", () => {
  it("appends content", () => {
    const result = patchContent(
      "line1\nline2\nline3\n",
      { contentStart: 6, contentEnd: 12 },
      "append",
      "new content",
    );

    expect(result).toContain("line2\n");
    expect(result).toContain("new content\n");
    expect(result).toContain("line3\n");
  });

  it("prepends content", () => {
    const result = patchContent(
      "line1\nline2\nline3\n",
      { contentStart: 6, contentEnd: 12 },
      "prepend",
      "new content",
    );

    expect(result).toContain("new content\n");
    expect(result).toContain("line2\n");
  });

  it("replaces content", () => {
    const result = patchContent(
      "line1\nline2\nline3\n",
      { contentStart: 6, contentEnd: 12 },
      "replace",
      "replaced",
    );

    expect(result).toContain("replaced\n");
    expect(result).not.toContain("line2\n");
    expect(result).toContain("line3\n");
  });

  it("handles empty new content", () => {
    const result = patchContent(
      "line1\nline2\nline3\n",
      { contentStart: 6, contentEnd: 12 },
      "replace",
      "",
    );

    expect(result).toBe("line1\nline3\n");
  });
});

describe("buildDocumentMap", () => {
  it("builds document map from cache", () => {
    const cache: CachedMetadata = {
      headings: [
        heading("Title", 1, 0),
        heading("Section", 2, 2),
      ],
      blocks: {
        block1: { id: "block1", position: { start: loc(5, 0, 0), end: loc(5, 10, 0) } },
      },
      frontmatter: {
        position: { start: loc(0, 0, 0), end: loc(3, 0, 0) },
        title: "Test",
        tags: ["a", "b"],
      },
    } as unknown as CachedMetadata;

    const map = MetadataService.buildDocumentMap(cache);

    expect(map.headings).toEqual(["# Title", "## Section"]);
    expect(map.blocks).toEqual(["block1"]);
    expect(map.frontmatterFields).toContain("title");
    expect(map.frontmatterFields).toContain("tags");
    expect(map.frontmatterFields).not.toContain("position");
  });

  it("handles empty cache", () => {
    const cache: CachedMetadata = {} as CachedMetadata;

    const map = MetadataService.buildDocumentMap(cache);

    expect(map.headings).toEqual([]);
    expect(map.blocks).toEqual([]);
    expect(map.frontmatterFields).toEqual([]);
  });
});
