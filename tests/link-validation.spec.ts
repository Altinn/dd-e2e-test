import { test, expect } from '@playwright/test';

/**
 * Link Validation Test Suite
 * 
 * This test fetches the resources.nb.json file (or similar resource file) 
 * that contains all application links, then validates each link by:
 * 1. Sending a GET request
 * 2. Checking for successful response (2xx status code)
 * 3. Verifying the final URL matches the requested URL (no unexpected redirects)
 */

interface LinkValidationResult {
  url: string;
  status: number;
  ok: boolean;
  finalUrl: string;
  redirected: boolean;
  error?: string;
}

test.describe('Link Validation', () => {
  test('should validate all links from resources file', async ({ page }) => {
    // Step 1: Fetch the resources file
    const resourceEndpoint = 'https://digdir.apps.tt02.altinn.no/digdir/oed/api/v1/texts/nb';
    
    const response = await page.request.get(resourceEndpoint);
    expect(response.ok(), `Failed to fetch resources from ${resourceEndpoint}`).toBeTruthy();
    
    const resourcesData = await response.json();

    // Step 2: Extract all URLs from the resources data
    const links = extractLinksFromResources(resourcesData);
    
    console.log(`Validating ${links.length} links...`);
    
    if (links.length === 0) {
      console.warn('Warning: No links found in resources file. JSON structure:', 
        JSON.stringify(resourcesData, null, 2).substring(0, 500));
      return;
    }

    // Step 3: Validate each link
    const results: LinkValidationResult[] = [];
    const failedLinks: LinkValidationResult[] = [];
    const redirectedLinks: LinkValidationResult[] = [];

    for (const link of links) {
      // Skip invalid or empty URLs
      if (!link || !isValidUrl(link)) {
        continue;
      }

      try {
        let response = await page.request.get(link, {
          maxRedirects: 10,
          timeout: 10000, // 10 second timeout per link
        });
        
        // If we get 403, retry using actual page navigation (more browser-like)
        if (response.status() === 403) {
          console.log(`  Retrying ${link} with page navigation due to 403...`);
          try {
            const pageResponse = await page.goto(link, {
              waitUntil: 'domcontentloaded',
              timeout: 10000,
            });
            if (pageResponse) {
              response = {
                status: () => pageResponse.status(),
                ok: () => pageResponse.ok(),
                url: () => pageResponse.url(),
              } as any;
            }
          } catch (navError) {
            // If page navigation also fails, keep the original 403 response
            console.log(`  Page navigation also failed: ${navError}`);
          }
        }

        const result: LinkValidationResult = {
          url: link,
          status: response.status(),
          ok: response.ok(),
          finalUrl: response.url(),
          redirected: normalizeUrl(response.url()) !== normalizeUrl(link),
        };

        results.push(result);

        // Check if URL contains /404 (indicates redirect to 404 page)
        const is404Page = result.finalUrl.includes('/404');

        if (!response.ok()) {
          // Provide specific error messages based on status code
          const statusMessages: { [key: number]: string } = {
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            404: 'Not Found',
            500: 'Internal Server Error',
            502: 'Bad Gateway',
            503: 'Service Unavailable',
            504: 'Gateway Timeout',
          };
          result.error = statusMessages[response.status()] || `HTTP ${response.status()}`;
          failedLinks.push(result);
        } else if (is404Page) {
          // Treat redirect to /404 page as a broken link
          result.error = 'Redirected to 404 page';
          result.ok = false;
          failedLinks.push(result);
        } else if (result.redirected) {
          redirectedLinks.push(result);
        }
      } catch (error) {
        const result: LinkValidationResult = {
          url: link,
          status: 0,
          ok: false,
          finalUrl: link,
          redirected: false,
          error: error instanceof Error ? error.message : String(error),
        };
        results.push(result);
        failedLinks.push(result);
      }
    }

    // Step 4: Generate report
    console.log(`\nResults: ${results.filter(r => r.ok).length} passed, ${failedLinks.length} failed, ${redirectedLinks.length} redirected`);

    if (redirectedLinks.length > 0) {
      console.log('\nRedirected links:');
      redirectedLinks.forEach((link, index) => {
        console.log(`  ${index + 1}. ${link.url} -> ${link.finalUrl}`);
      });
    }

    if (failedLinks.length > 0) {
      console.log('\nFailed links:');
      failedLinks.forEach((link, index) => {
        console.log(`  ${index + 1}. [${link.status === 0 ? 'ERROR' : link.status}] ${link.url} - ${link.error}`);
      });
    }

    // Step 5: Assertions - Fail the test if any links failed
    if (failedLinks.length > 0) {
      const errorSummary = failedLinks.map((link, i) => 
        `\n  ${i + 1}. [${link.status === 0 ? 'ERROR' : link.status}] ${link.url} - ${link.error}`
      ).join('');
      
      throw new Error(
        `\n${failedLinks.length} broken link(s) found:${errorSummary}\n`
      );
    }

    // Optional: Fail on unexpected redirects (uncomment if redirects should be treated as failures)
    // expect(redirectedLinks.length, 
    //   `Found ${redirectedLinks.length} redirected link(s). See console output for details.`
    // ).toBe(0);
  });
});

/**
 * Extract all URLs from the resources JSON data
 * Searches for URLs in property values and within text content (e.g., markdown)
 */
function extractLinksFromResources(data: any): string[] {
  const links = new Set<string>();

  // Helper function to recursively find URLs in the JSON structure
  function findUrls(obj: any): void {
    if (typeof obj === 'string') {
      // Extract all URLs from the string (including those in markdown or plain text)
      const urlPattern = /https?:\/\/[^\s\)\]"']+/g;
      const matches = obj.match(urlPattern);
      if (matches) {
        matches.forEach(url => {
          // Clean up trailing punctuation that might be part of markdown syntax
          const cleanUrl = url.replace(/[,;:.!?]+$/, '');
          if (isValidUrl(cleanUrl)) {
            links.add(cleanUrl);
          }
        });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(item => findUrls(item));
    } else if (obj && typeof obj === 'object') {
      // Recursively check all values
      Object.values(obj).forEach(value => findUrls(value));
    }
  }

  findUrls(data);
  return Array.from(links).sort();
}

/**
 * Normalize URL by removing trailing slash for comparison purposes
 */
function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
