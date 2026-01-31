/**
 * GetYourGuide Affiliate Link Generator
 *
 * Semi-automated tool to generate GYG affiliate links for blog posts
 *
 * Usage:
 *   node tools/gyg-link-generator.js "tokyo"
 *   node tools/gyg-link-generator.js "barcelona tours"
 *   node tools/gyg-link-generator.js --list "paris,rome,london"
 *
 * This tool:
 * 1. Searches GetYourGuide for your destination/activity
 * 2. Returns the top activities with affiliate-ready links
 * 3. Outputs in formats ready for Bligence/WordPress
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Your GetYourGuide partner base URL
// Note: GYG uses query parameter 'partner_id' or path-based tracking
// Update this with your actual partner tracking format
const GYG_BASE = 'https://www.getyourguide.com';

/**
 * Search GetYourGuide and return top activities
 */
async function searchGetYourGuide(searchQuery, limit = 10) {
  console.log(`\n🔍 Searching GetYourGuide for: "${searchQuery}"`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  const activities = [];

  try {
    // Search URL
    const searchUrl = `${GYG_BASE}/s/?q=${encodeURIComponent(searchQuery)}&searchSource=3`;
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Find activity cards
    const cards = await page.$$('[data-activity-id], .activity-card, [data-testid="activity-card"]');

    console.log(`Found ${cards.length} activities`);

    for (const card of cards.slice(0, limit)) {
      try {
        // Get activity link
        const linkElement = await card.$('a[href*="/activity/"]');
        if (!linkElement) continue;

        const href = await linkElement.getAttribute('href');
        const fullUrl = href.startsWith('http') ? href : `${GYG_BASE}${href}`;

        // Get activity title
        const titleElement = await card.$('h3, h2, [data-testid="activity-card-title"]');
        const title = titleElement ? (await titleElement.textContent()).trim() : 'Activity';

        // Get price
        const priceElement = await card.$('[data-testid="activity-card-price"], .activity-card-price');
        let price = null;
        if (priceElement) {
          const priceText = await priceElement.textContent();
          const priceMatch = priceText.match(/\$(\d+)/);
          price = priceMatch ? parseInt(priceMatch[1]) : null;
        }

        // Get rating
        const ratingElement = await card.$('[data-testid="activity-card-rating"], .activity-rating');
        let rating = null;
        let reviewCount = null;
        if (ratingElement) {
          const ratingText = await ratingElement.textContent();
          const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
          rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
          const reviewMatch = ratingText.match(/\((\d+[,\d]*)\)/);
          reviewCount = reviewMatch ? reviewMatch[1] : null;
        }

        // Get image
        const imgElement = await card.$('img');
        const imageUrl = imgElement ? await imgElement.getAttribute('src') : null;

        activities.push({
          title,
          url: fullUrl,
          price,
          rating,
          reviewCount,
          imageUrl,
          searchQuery
        });
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    console.error('Search failed:', error.message);
  }

  await browser.close();
  return activities;
}

/**
 * Format activities for different outputs
 */
function formatOutput(activities, format = 'markdown') {
  if (format === 'markdown') {
    let output = `## Top Activities\n\n`;
    activities.forEach((act, i) => {
      output += `### ${i + 1}. ${act.title}\n`;
      if (act.rating) output += `⭐ ${act.rating}${act.reviewCount ? ` (${act.reviewCount} reviews)` : ''}\n`;
      if (act.price) output += `💰 From $${act.price}\n`;
      output += `🔗 [Book Now](${act.url})\n\n`;
    });
    return output;
  }

  if (format === 'html') {
    let output = `<div class="gyg-activities">\n`;
    activities.forEach((act) => {
      output += `  <div class="activity">\n`;
      if (act.imageUrl) output += `    <img src="${act.imageUrl}" alt="${act.title}" />\n`;
      output += `    <h3>${act.title}</h3>\n`;
      if (act.rating) output += `    <span class="rating">⭐ ${act.rating}</span>\n`;
      if (act.price) output += `    <span class="price">From $${act.price}</span>\n`;
      output += `    <a href="${act.url}" class="btn" target="_blank" rel="nofollow sponsored">Book Now</a>\n`;
      output += `  </div>\n`;
    });
    output += `</div>`;
    return output;
  }

  if (format === 'bligence') {
    // Format suitable for copy-paste into Bligence
    let output = `AFFILIATE LINKS FOR BLIGENCE:\n\n`;
    activities.forEach((act, i) => {
      output += `Link ${i + 1}: ${act.title}\n`;
      output += `URL: ${act.url}\n`;
      output += `Anchor text suggestions: "Book ${act.title}", "Reserve your spot", "Get tickets"\n\n`;
    });
    return output;
  }

  if (format === 'json') {
    return JSON.stringify(activities, null, 2);
  }

  // Default: simple list
  return activities.map((act, i) =>
    `${i + 1}. ${act.title}\n   ${act.url}`
  ).join('\n\n');
}

/**
 * Generate a quick lookup table for common destinations
 */
async function generateDestinationLinks(destinations) {
  const results = {};

  for (const dest of destinations) {
    console.log(`\nProcessing: ${dest}`);
    const activities = await searchGetYourGuide(dest, 5);
    results[dest] = activities;

    // Rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  return results;
}

/**
 * Interactive mode - quick search from command line
 */
async function interactiveSearch() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║     GetYourGuide Affiliate Link Generator                ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Usage:                                                  ║
║    node tools/gyg-link-generator.js "destination"        ║
║    node tools/gyg-link-generator.js "tokyo food tour"    ║
║    node tools/gyg-link-generator.js --list "a,b,c"       ║
║    node tools/gyg-link-generator.js --format html "rome" ║
║                                                          ║
║  Formats: markdown, html, bligence, json, simple         ║
║                                                          ║
║  Examples:                                               ║
║    node tools/gyg-link-generator.js "barcelona"          ║
║    node tools/gyg-link-generator.js --format bligence    ║
║         "tokyo day trips"                                ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
    return;
  }

  let format = 'markdown';
  let searchTerms = [];

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      format = args[i + 1];
      i++;
    } else if (args[i] === '--list' && args[i + 1]) {
      searchTerms = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (!args[i].startsWith('--')) {
      searchTerms.push(args[i]);
    }
  }

  if (searchTerms.length === 0) {
    console.log('Please provide a search term');
    return;
  }

  // Search and display results
  for (const term of searchTerms) {
    const activities = await searchGetYourGuide(term, 10);

    if (activities.length === 0) {
      console.log(`\nNo activities found for "${term}"`);
      continue;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Results for: ${term}`);
    console.log('='.repeat(60) + '\n');

    const formatted = formatOutput(activities, format);
    console.log(formatted);

    // Also save to file
    const outputDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `gyg-${term.replace(/\s+/g, '-').toLowerCase()}.${format === 'json' ? 'json' : 'txt'}`;
    fs.writeFileSync(path.join(outputDir, filename), formatted);
    console.log(`\n📁 Saved to: output/${filename}`);
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  interactiveSearch()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { searchGetYourGuide, formatOutput, generateDestinationLinks };
