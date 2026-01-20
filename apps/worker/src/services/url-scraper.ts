import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";

export interface ScrapedContent {
  content: string;
  metadata: {
    title?: string;
    description?: string;
    author?: string;
    publishedDate?: string;
  };
  images: string[];
}

/**
 * Scrape content from a URL, extracting article text, metadata, and images
 * @param url - The URL to scrape
 * @returns Scraped content with text, metadata, and image references
 */
export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  try {
    // Fetch the URL
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CanvasCast/1.0; +https://canvascast.com)",
      },
    });

    // Check if response is ok
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      throw new Error("URL does not return HTML content");
    }

    // Get HTML content
    const html = await response.text();

    // Parse with cheerio for metadata and images
    const $ = cheerio.load(html);

    // Extract metadata
    const metadata = extractMetadata($);

    // Extract images
    const images = extractImages($, url);

    // Use Readability for article content extraction
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    // Fallback to basic text extraction if Readability fails
    let content = article?.textContent || "";

    if (!content || content.trim().length === 0) {
      // Fallback: extract text from body, removing script and style tags
      content = $("body")
        .clone()
        .find("script, style, nav, footer, aside")
        .remove()
        .end()
        .text()
        .replace(/\s+/g, " ")
        .trim();
    }

    // Use article title if available, otherwise use metadata title
    const finalMetadata = {
      ...metadata,
      title: article?.title || metadata.title,
    };

    return {
      content,
      metadata: finalMetadata,
      images,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to scrape URL: ${error.message}`);
    }
    throw new Error("Failed to scrape URL: Unknown error");
  }
}

/**
 * Extract metadata from HTML using cheerio
 */
function extractMetadata($: cheerio.CheerioAPI): ScrapedContent["metadata"] {
  const metadata: ScrapedContent["metadata"] = {};

  // Title: OpenGraph > meta title > document title
  metadata.title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="title"]').attr("content") ||
    $("title").text() ||
    undefined;

  // Description: OpenGraph > meta description
  metadata.description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    undefined;

  // Author
  metadata.author =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    undefined;

  // Published date
  metadata.publishedDate =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="publish_date"]').attr("content") ||
    undefined;

  return metadata;
}

/**
 * Extract all image URLs from HTML, converting relative URLs to absolute
 */
function extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images = new Set<string>();

  // Extract OpenGraph image
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) {
    images.add(resolveUrl(ogImage, baseUrl));
  }

  // Extract Twitter card image
  const twitterImage = $('meta[name="twitter:image"]').attr("content");
  if (twitterImage) {
    images.add(resolveUrl(twitterImage, baseUrl));
  }

  // Extract all img tags in the content
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (src) {
      images.add(resolveUrl(src, baseUrl));
    }
  });

  return Array.from(images);
}

/**
 * Resolve relative URLs to absolute URLs
 */
function resolveUrl(urlString: string, baseUrl: string): string {
  try {
    return new URL(urlString, baseUrl).href;
  } catch {
    // If URL parsing fails, return the original string
    return urlString;
  }
}
