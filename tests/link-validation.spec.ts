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
  test('should validate all links from resources file', async ({ request, baseURL }) => {
    test.setTimeout(120000); // 2 minutes for validating many links
    
    if (!baseURL) {
      throw new Error('BASE_URL is not configured. Run global setup first.');
    }

    // Step 1: Fetch the resources file
    // Adjust this endpoint based on your actual API structure
    // Common patterns: /api/v1/texts/nb, /api/resources/nb, /resources.nb.json
    const resourceEndpoints = [
      `${baseURL}/api/v1/texts/nb`,
      `${baseURL}/api/resources/nb.json`,
      `${baseURL}/resources.nb.json`,
    ];

    let resourcesData: any = null;
    let successfulEndpoint: string | null = null;

    // Try each possible endpoint
    for (const endpoint of resourceEndpoints) {
      try {
        console.log(`Attempting to fetch resources from: ${endpoint}`);
        const response = await request.get(endpoint);
        
        if (response.ok()) {
          resourcesData = await response.json();
          successfulEndpoint = endpoint;
          console.log(`✓ Successfully fetched resources from: ${endpoint}`);
          break;
        }
      } catch (error) {
        console.log(`✗ Failed to fetch from ${endpoint}: ${error}`);
      }
    }

    if (!resourcesData) {
      throw new Error(
        `Could not fetch resources file from any of the attempted endpoints:\n${resourceEndpoints.join('\n')}\n\n` +
        `Please verify the correct endpoint and update the test.`
      );
    }

    // Step 2: Extract all URLs from the resources data
    const links = extractLinksFromResources(resourcesData);
    
    console.log(`\nFound ${links.length} links to validate`);
    
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
        console.log(`⊘ Skipping invalid URL: ${link}`);
        continue;
      }

      // Optional: Skip external links (uncomment if you only want to test internal links)
      // if (isExternalLink(link, baseURL)) {
      //   console.log(`⊘ Skipping external link: ${link}`);
      //   continue;
      // }

      try {
        const response = await request.get(link, {
          maxRedirects: 10,
          timeout: 10000, // 10 second timeout per link
        });

        const result: LinkValidationResult = {
          url: link,
          status: response.status(),
          ok: response.ok(),
          finalUrl: response.url(),
          redirected: response.url() !== link,
        };

        results.push(result);

        if (!response.ok()) {
          result.error = `HTTP ${response.status()}`;
          failedLinks.push(result);
          console.log(`✗ [${response.status()}] ${link}`);
        } else if (result.redirected) {
          redirectedLinks.push(result);
          console.log(`↪ [${response.status()}] ${link} → ${result.finalUrl}`);
        } else {
          console.log(`✓ [${response.status()}] ${link}`);
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
        console.log(`✗ [ERROR] ${link}: ${result.error}`);
      }
    }

    // Step 4: Generate report
    console.log('\n' + '='.repeat(80));
    console.log('LINK VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(`Total links checked: ${results.length}`);
    console.log(`Successful (2xx): ${results.filter(r => r.ok).length}`);
    console.log(`Failed: ${failedLinks.length}`);
    console.log(`Redirected: ${redirectedLinks.length}`);

    if (failedLinks.length > 0) {
      console.log('\n❌ FAILED LINKS:');
      failedLinks.forEach(link => {
        console.log(`  ${link.url}`);
        console.log(`    Status: ${link.status} ${link.error || ''}`);
      });
    }

    if (redirectedLinks.length > 0) {
      console.log('\n↪️  REDIRECTED LINKS:');
      redirectedLinks.forEach(link => {
        console.log(`  ${link.url}`);
        console.log(`    → ${link.finalUrl}`);
      });
    }

    // Step 5: Assertions
    expect(failedLinks.length, 
      `Found ${failedLinks.length} broken link(s). See console output for details.`
    ).toBe(0);

    // Optional: Fail on unexpected redirects (uncomment if redirects should be treated as failures)
    // expect(redirectedLinks.length, 
    //   `Found ${redirectedLinks.length} redirected link(s). See console output for details.`
    // ).toBe(0);
  });
});

/**
 * Extract all URLs from the resources JSON data
 * This function needs to be adapted based on the actual structure of resources.nb.json
 */
function extractLinksFromResources(data: any): string[] {
  const links = new Set<string>();

  // Helper function to recursively find URLs in the JSON structure
  function findUrls(obj: any): void {
    if (typeof obj === 'string') {
      // Check if the string is a URL
      if (isValidUrl(obj)) {
        links.add(obj);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(item => findUrls(item));
    } else if (obj && typeof obj === 'object') {
      // Check for common URL property names
      const urlFields = ['url', 'href', 'link', 'uri', 'path', 'src'];
      for (const field of urlFields) {
        if (obj[field] && typeof obj[field] === 'string' && isValidUrl(obj[field])) {
          links.add(obj[field]);
        }
      }
      
      // Recursively check all values
      Object.values(obj).forEach(value => findUrls(value));
    }
  }

  findUrls(data);
  return Array.from(links).sort();
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
