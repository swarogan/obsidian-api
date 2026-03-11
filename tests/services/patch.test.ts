import { describe, it, expect } from "vitest";
import {
  findHeadingBounds,
  findBlockBounds,
  patchContent,
  parseHeadingsFromContent,
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

describe("parseHeadingsFromContent", () => {
  it("parses ATX headings", () => {
    const content = "# H1\n## H2\n### H3\ntext\n#### H4";
    const headings = parseHeadingsFromContent(content);

    expect(headings).toEqual([
      { heading: "H1", level: 1, line: 0 },
      { heading: "H2", level: 2, line: 1 },
      { heading: "H3", level: 3, line: 2 },
      { heading: "H4", level: 4, line: 4 },
    ]);
  });

  it("skips headings inside code blocks", () => {
    const content = "# Real\n```\n## Fake\n```\n## Also Real";
    const headings = parseHeadingsFromContent(content);

    expect(headings).toHaveLength(2);
    expect(headings[0].heading).toBe("Real");
    expect(headings[1].heading).toBe("Also Real");
  });

  it("skips headings inside tilde code blocks", () => {
    const content = "# Real\n~~~\n## Fake\n~~~\n## Also Real";
    const headings = parseHeadingsFromContent(content);

    expect(headings).toHaveLength(2);
  });

  it("skips frontmatter", () => {
    const content = "---\ntitle: Test\n---\n# Heading";
    const headings = parseHeadingsFromContent(content);

    expect(headings).toHaveLength(1);
    expect(headings[0].heading).toBe("Heading");
    expect(headings[0].line).toBe(3);
  });

  it("handles trailing hashes", () => {
    const content = "## Heading ##";
    const headings = parseHeadingsFromContent(content);

    expect(headings).toHaveLength(1);
    expect(headings[0].heading).toBe("Heading");
  });

  it("handles unicode headings", () => {
    const content = "# Główny nagłówek\n## Sekcja żółć";
    const headings = parseHeadingsFromContent(content);

    expect(headings).toEqual([
      { heading: "Główny nagłówek", level: 1, line: 0 },
      { heading: "Sekcja żółć", level: 2, line: 1 },
    ]);
  });

  it("does not parse lines without space after hashes", () => {
    const content = "#Not a heading\n## Real heading";
    const headings = parseHeadingsFromContent(content);

    expect(headings).toHaveLength(1);
    expect(headings[0].heading).toBe("Real heading");
  });
});

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

  it("finds top-level heading bounds", () => {
    const bounds = findHeadingBounds(["Title"], content);
    expect(bounds).not.toBeNull();

    const extracted = content.slice(bounds!.contentStart, bounds!.contentEnd);
    expect(extracted).toContain("intro text");
  });

  it("finds section A bounds", () => {
    const bounds = findHeadingBounds(["Section A"], content);
    expect(bounds).not.toBeNull();

    const extracted = content.slice(bounds!.contentStart, bounds!.contentEnd);
    expect(extracted).toContain("content A line 1");
    expect(extracted).toContain("content A line 2");
    expect(extracted).not.toContain("content B");
  });

  it("finds section B bounds including subsection", () => {
    const bounds = findHeadingBounds(["Section B"], content);
    expect(bounds).not.toBeNull();

    const extracted = content.slice(bounds!.contentStart, bounds!.contentEnd);
    expect(extracted).toContain("content B");
    expect(extracted).toContain("Subsection B1");
    expect(extracted).toContain("sub content B1");
    expect(extracted).not.toContain("content C");
  });

  it("finds nested heading path", () => {
    const bounds = findHeadingBounds(["Section B", "Subsection B1"], content);
    expect(bounds).not.toBeNull();

    const extracted = content.slice(bounds!.contentStart, bounds!.contentEnd);
    expect(extracted).toContain("sub content B1");
    expect(extracted).not.toContain("content B\n###");
  });

  it("returns null for non-existent heading", () => {
    const bounds = findHeadingBounds(["Nonexistent"], content);
    expect(bounds).toBeNull();
  });

  it("returns null for empty heading path", () => {
    const bounds = findHeadingBounds([], content);
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

    const bounds = findHeadingBounds(["Sekcja żółć"], unicodeContent);
    expect(bounds).not.toBeNull();

    const extracted = unicodeContent.slice(bounds!.contentStart, bounds!.contentEnd);
    expect(extracted).toContain("treść sekcji");
    expect(extracted).not.toContain("treść następna");
  });

  it("ignores headings inside code blocks", () => {
    const codeContent = [
      "# Real heading",
      "some text",
      "```",
      "## Fake heading",
      "```",
      "## Another real",
      "more text",
    ].join("\n");

    const bounds = findHeadingBounds(["Fake heading"], codeContent);
    expect(bounds).toBeNull();

    const realBounds = findHeadingBounds(["Another real"], codeContent);
    expect(realBounds).not.toBeNull();
    const extracted = codeContent.slice(realBounds!.contentStart, realBounds!.contentEnd);
    expect(extracted).toContain("more text");
  });

  it("works with frontmatter", () => {
    const fmContent = [
      "---",
      "title: Test",
      "---",
      "# Heading",
      "content here",
    ].join("\n");

    const bounds = findHeadingBounds(["Heading"], fmContent);
    expect(bounds).not.toBeNull();

    const extracted = fmContent.slice(bounds!.contentStart, bounds!.contentEnd);
    expect(extracted).toContain("content here");
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
