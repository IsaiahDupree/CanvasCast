import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch
global.fetch = vi.fn();

// Import after mocks
import { scrapeUrl } from "../../src/services/url-scraper";

describe("URL Scraper Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scrapeUrl", () => {
    it("should extract article content from a blog post URL", async () => {
      // Arrange
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Article</title>
            <meta name="description" content="This is a test article">
            <meta property="og:image" content="https://example.com/image.jpg">
          </head>
          <body>
            <article>
              <h1>Test Article Title</h1>
              <p>This is the first paragraph of the article.</p>
              <p>This is the second paragraph with important content.</p>
              <img src="https://example.com/content-image.jpg" alt="Content image">
            </article>
          </body>
        </html>
      `;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => mockHtml,
      } as Response);

      // Act
      const result = await scrapeUrl("https://example.com/blog/test-article");

      // Assert
      expect(result.content).toContain("Test Article Title");
      expect(result.content).toContain("first paragraph");
      expect(result.content).toContain("second paragraph");
      expect(result.metadata.title).toBe("Test Article");
      expect(result.metadata.description).toBe("This is a test article");
      expect(result.images).toContain("https://example.com/image.jpg");
      expect(result.images).toContain("https://example.com/content-image.jpg");
    });

    it("should parse metadata from Open Graph and meta tags", async () => {
      // Arrange
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Original Title</title>
            <meta name="description" content="Meta description">
            <meta property="og:title" content="OG Title">
            <meta property="og:description" content="OG description">
            <meta property="og:image" content="https://example.com/og-image.jpg">
            <meta name="author" content="John Doe">
          </head>
          <body>
            <article>
              <p>Article content here.</p>
            </article>
          </body>
        </html>
      `;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => mockHtml,
      } as Response);

      // Act
      const result = await scrapeUrl("https://example.com/article");

      // Assert
      expect(result.metadata.title).toBe("OG Title"); // OG takes precedence
      expect(result.metadata.description).toBe("OG description");
      expect(result.metadata.author).toBe("John Doe");
      expect(result.images).toContain("https://example.com/og-image.jpg");
    });

    it("should handle URLs with no article content gracefully", async () => {
      // Arrange
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Homepage</title></head>
          <body>
            <nav>Navigation</nav>
            <footer>Footer</footer>
          </body>
        </html>
      `;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => mockHtml,
      } as Response);

      // Act
      const result = await scrapeUrl("https://example.com/");

      // Assert
      expect(result.content).toBeTruthy(); // Should still have some content
      expect(result.metadata.title).toBe("Homepage");
      expect(result.images).toEqual([]);
    });

    it("should handle fetch errors gracefully", async () => {
      // Arrange
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      // Act & Assert
      await expect(scrapeUrl("https://invalid-url.com")).rejects.toThrow(
        "Failed to scrape URL: Network error"
      );
    });

    it("should handle non-HTML content types", async () => {
      // Arrange
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => '{"data": "test"}',
      } as Response);

      // Act & Assert
      await expect(scrapeUrl("https://example.com/api/data")).rejects.toThrow(
        "URL does not return HTML content"
      );
    });

    it("should handle HTTP error responses", async () => {
      // Arrange
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      // Act & Assert
      await expect(scrapeUrl("https://example.com/404")).rejects.toThrow(
        "Failed to fetch URL: 404 Not Found"
      );
    });

    it("should extract all images from article content", async () => {
      // Arrange
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:image" content="https://example.com/og.jpg">
          </head>
          <body>
            <article>
              <h1>Gallery Article</h1>
              <img src="https://example.com/img1.jpg" alt="Image 1">
              <img src="https://example.com/img2.png" alt="Image 2">
              <img src="https://example.com/img3.webp" alt="Image 3">
            </article>
          </body>
        </html>
      `;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => mockHtml,
      } as Response);

      // Act
      const result = await scrapeUrl("https://example.com/gallery");

      // Assert
      expect(result.images).toHaveLength(4);
      expect(result.images).toContain("https://example.com/og.jpg");
      expect(result.images).toContain("https://example.com/img1.jpg");
      expect(result.images).toContain("https://example.com/img2.png");
      expect(result.images).toContain("https://example.com/img3.webp");
    });

    it("should handle relative image URLs correctly", async () => {
      // Arrange
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:image" content="/images/og.jpg">
          </head>
          <body>
            <article>
              <img src="/assets/photo.jpg" alt="Photo">
              <img src="images/icon.png" alt="Icon">
            </article>
          </body>
        </html>
      `;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => mockHtml,
      } as Response);

      // Act
      const result = await scrapeUrl("https://example.com/blog/post");

      // Assert
      expect(result.images).toContain("https://example.com/images/og.jpg");
      expect(result.images).toContain("https://example.com/assets/photo.jpg");
      expect(result.images).toContain("https://example.com/blog/images/icon.png");
    });
  });
});
