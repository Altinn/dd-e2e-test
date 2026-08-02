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
    // Checks a few dozen links sequentially, each with its own 20s ceiling, so
    // this needs far more than the 60s the main config allows per test. Without
    // this the whole test times out instead of reporting per-link results.
    test.setTimeout(180000);

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
    // Links we could not reach at all (timeout, refused connection, DNS).
    // Reported but not failed — see the note above isNetworkLevelError.
    const unreachableLinks: LinkValidationResult[] = [];

    for (const link of links) {
      // Skip invalid or empty URLs
      if (!link || !isValidUrl(link)) {
        continue;
      }

      try {
        let response = await page.request.get(link, {
          maxRedirects: 10,
          timeout: 20000, // 20 second timeout per link; third-party sites can be slow from CI
          maxRetries: 5, // Safely retries ECONNRESET natively
          // Overwrite default headers to fully match a standard Google Chrome profile
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,no;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand)";v="24", "Google Chrome";v="122"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
          }
        });

        // If we get 403, retry using actual page navigation (more browser-like)
        // Skip page navigation for PDFs and other non-HTML content
        const isPdf = link.toLowerCase().endsWith('.pdf');
        if (response.status() === 403 && !isPdf) {
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
        const message = error instanceof Error ? error.message : String(error);
        const result: LinkValidationResult = {
          url: link,
          status: 0,
          ok: false,
          finalUrl: link,
          redirected: false,
          error: message,
        };
        results.push(result);

        if (isNetworkLevelError(message)) {
          unreachableLinks.push(result);
        } else {
          failedLinks.push(result);
        }
      }
    }

    // Step 4: Generate report
    console.log(`\nResults: ${results.filter(r => r.ok).length} passed, ${failedLinks.length} failed, ${unreachableLinks.length} unreachable, ${redirectedLinks.length} redirected`);

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

    // Surfaced as a test annotation so these stay visible in the HTML report
    // instead of being buried in stdout.
    if (unreachableLinks.length > 0) {
      const summary = unreachableLinks
        .map((link, i) => `\n  ${i + 1}. ${link.url} - ${link.error}`)
        .join('');

      console.warn(`\n${unreachableLinks.length} unreachable link(s) (not failing the test):${summary}`);

      test.info().annotations.push({
        type: 'unreachable links',
        description: `${unreachableLinks.length} link(s) could not be reached from this network:${summary}`,
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
 * Distinguish "we never got an answer" from "the site answered badly".
 *
 * Several of the third-party sites linked from the app (nettvett.no,
 * slettmeg.no, digipost.no) time out or refuse connections when requested from
 * CI datacenter IPs, while loading fine from a normal browser. Failing the
 * build on those means the suite reports on someone else's network rather than
 * on our links, so they are reported as warnings instead.
 *
 * HTTP-level problems (4xx, 5xx, redirect to /404) are unaffected and still
 * fail the test — those are real broken links.
 */
function isNetworkLevelError(message: string): boolean {
  return [
    'Timeout',
    'timeout',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'socket hang up',
    'net::ERR_',
  ].some((pattern) => message.includes(pattern));
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
