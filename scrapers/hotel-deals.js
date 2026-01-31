/**
 * Hotel Deals Scraper for eTravelogs
 * Uses Playwright to scrape Google Hotels for deals
 *
 * Strategy: Find hotels with significant discounts in popular destinations
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { format, addDays, addMonths } = require('date-fns');

// Configuration
const CONFIG = {
  // Expedia affiliate info
  expediaAffiliateTag: process.env.EXPEDIA_AFFILIATE_TAG || 'etravelogs',
  expediaPublisherId: process.env.EXPEDIA_PUBLISHER_ID || '1011l387199',

  // Popular destinations for hotel deals
  destinations: [
    { name: 'Paris', country: 'France', searchTerm: 'Paris, France' },
    { name: 'London', country: 'UK', searchTerm: 'London, England' },
    { name: 'Tokyo', country: 'Japan', searchTerm: 'Tokyo, Japan' },
    { name: 'Rome', country: 'Italy', searchTerm: 'Rome, Italy' },
    { name: 'Barcelona', country: 'Spain', searchTerm: 'Barcelona, Spain' },
    { name: 'Cancun', country: 'Mexico', searchTerm: 'Cancun, Mexico' },
    { name: 'New York', country: 'USA', searchTerm: 'New York City' },
    { name: 'Las Vegas', country: 'USA', searchTerm: 'Las Vegas' },
    { name: 'Miami', country: 'USA', searchTerm: 'Miami, Florida' },
    { name: 'Honolulu', country: 'USA', searchTerm: 'Honolulu, Hawaii' },
    { name: 'San Francisco', country: 'USA', searchTerm: 'San Francisco' },
    { name: 'Los Angeles', country: 'USA', searchTerm: 'Los Angeles' },
    { name: 'Amsterdam', country: 'Netherlands', searchTerm: 'Amsterdam, Netherlands' },
    { name: 'Dublin', country: 'Ireland', searchTerm: 'Dublin, Ireland' },
    { name: 'Lisbon', country: 'Portugal', searchTerm: 'Lisbon, Portugal' },
    { name: 'Bangkok', country: 'Thailand', searchTerm: 'Bangkok, Thailand' },
    { name: 'Singapore', country: 'Singapore', searchTerm: 'Singapore' },
    { name: 'Bali', country: 'Indonesia', searchTerm: 'Bali, Indonesia' },
    { name: 'Phuket', country: 'Thailand', searchTerm: 'Phuket, Thailand' },
    { name: 'Maldives', country: 'Maldives', searchTerm: 'Maldives' }
  ],

  // Minimum discount to include (percentage)
  minDiscountPercent: 25
};

/**
 * Generate Expedia deeplink for a hotel search
 */
function generateExpediaHotelLink(destination, checkinDate, checkoutDate) {
  const baseUrl = 'https://www.expedia.com/Hotel-Search';
  const params = new URLSearchParams({
    destination: destination,
    startDate: format(checkinDate, 'MM/dd/yyyy'),
    endDate: format(checkoutDate, 'MM/dd/yyyy'),
    rooms: '1',
    adults: '2',
    AFFCID: `US.DIRECT.PHG.${CONFIG.expediaPublisherId}.${CONFIG.expediaAffiliateTag}`
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate Expedia deeplink for a specific hotel
 */
function generateExpediaHotelDirectLink(hotelName, destination, checkinDate, checkoutDate) {
  const baseUrl = 'https://www.expedia.com/Hotel-Search';
  const params = new URLSearchParams({
    destination: destination,
    startDate: format(checkinDate, 'MM/dd/yyyy'),
    endDate: format(checkoutDate, 'MM/dd/yyyy'),
    hotelName: hotelName,
    sort: 'RECOMMENDED',
    AFFCID: `US.DIRECT.PHG.${CONFIG.expediaPublisherId}.${CONFIG.expediaAffiliateTag}`
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Scrape Google Hotels for deals in a destination
 */
async function scrapeGoogleHotels(page, destination) {
  const deals = [];

  // Calculate stay dates (2 months out, 3-night stay)
  const checkinDate = addMonths(new Date(), 2);
  const checkoutDate = addDays(checkinDate, 3);

  const checkinStr = format(checkinDate, 'yyyy-MM-dd');
  const checkoutStr = format(checkoutDate, 'yyyy-MM-dd');

  try {
    // Google Hotels search URL
    const searchUrl = `https://www.google.com/travel/hotels/${encodeURIComponent(destination.searchTerm)}?q=${encodeURIComponent(destination.searchTerm + ' hotels')}&g2lb=4814050,4874190,4893075,4965990,4969803,72277293,72302247,72317059,72406588,72414906,72421566,72471280,72472051,72481459,72485658,72499705,72513513,72536387,72538597,72549171,72560029,72570850,72592643&hl=en-US&gl=us&cs=1&ssta=1&ts=CAESABogCgIaABIaEhQKBwjoDxAJGBESBwjoDxAJGBIYATICEAAqCQoFOgNVU0QaAA&ap=MAFoAQ`;

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(4000); // Let hotel cards load

    // Try to find hotel cards with prices and discounts
    // Google Hotels shows "Usually $X" with current price
    const hotelCards = await page.$$('[data-ved] [role="listitem"], .K1smNd, [jsname="mutHjb"]');

    console.log(`  Found ${hotelCards.length} hotel cards`);

    for (const card of hotelCards.slice(0, 15)) { // Check first 15 hotels
      try {
        const cardText = await card.textContent();

        // Look for hotel name
        const nameElement = await card.$('h2, [role="heading"], .QT7m7');
        const hotelName = nameElement ? await nameElement.textContent() : null;

        // Look for current price
        const priceMatch = cardText.match(/\$(\d+)/);

        // Look for "Usually" or "was" price (indicates discount)
        const usuallyMatch = cardText.match(/[Uu]sually\s*\$(\d+)/i);
        const wasMatch = cardText.match(/[Ww]as\s*\$(\d+)/i);

        // Look for rating
        const ratingMatch = cardText.match(/(\d\.\d)\s*(?:star|★|\()/);

        if (priceMatch) {
          const currentPrice = parseInt(priceMatch[1]);
          const originalPrice = usuallyMatch ? parseInt(usuallyMatch[1]) : (wasMatch ? parseInt(wasMatch[1]) : null);

          let percentOff = 0;
          if (originalPrice && originalPrice > currentPrice) {
            percentOff = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
          }

          // Only include if good deal (>25% off) or luxury at good price
          if (percentOff >= CONFIG.minDiscountPercent || (currentPrice < 150 && ratingMatch && parseFloat(ratingMatch[1]) >= 4.0)) {
            deals.push({
              hotelName: hotelName ? hotelName.trim() : `Hotel in ${destination.name}`,
              location: destination.name,
              country: destination.country,
              pricePerNight: currentPrice,
              originalPrice: originalPrice,
              percentOff: percentOff,
              rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
              checkinDate: checkinStr,
              checkoutDate: checkoutStr,
              nights: 3,
              source: 'Google Hotels',
              scrapedAt: new Date().toISOString(),
              expediaSearchLink: generateExpediaHotelLink(destination.searchTerm, checkinDate, checkoutDate),
              expediaDirectLink: hotelName ? generateExpediaHotelDirectLink(hotelName.trim(), destination.searchTerm, checkinDate, checkoutDate) : null
            });
          }
        }
      } catch (e) {
        continue; // Skip this card if parsing fails
      }
    }
  } catch (error) {
    console.error(`Error scraping hotels in ${destination.name}:`, error.message);
  }

  return deals;
}

/**
 * Scrape specific deal pages (kayak, etc.) for flash sales
 */
async function scrapeHotelDealPages(page) {
  const deals = [];

  // Try to scrape Kayak deals page
  try {
    await page.goto('https://www.kayak.com/deals', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Look for hotel deal cards
    const dealCards = await page.$$('[data-resultid], .resultWrapper');

    for (const card of dealCards.slice(0, 10)) {
      try {
        const text = await card.textContent();
        const priceMatch = text.match(/\$(\d+)/);
        const discountMatch = text.match(/(\d+)%\s*off/i);

        if (priceMatch && discountMatch) {
          const price = parseInt(priceMatch[1]);
          const discount = parseInt(discountMatch[1]);

          if (discount >= 30) {
            deals.push({
              hotelName: 'Kayak Deal',
              pricePerNight: price,
              percentOff: discount,
              source: 'Kayak Deals',
              scrapedAt: new Date().toISOString()
            });
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    console.log('Kayak deals page not accessible, skipping...');
  }

  return deals;
}

/**
 * Main scraper function
 */
async function scrapeHotelDeals() {
  console.log('Starting hotel deals scraper...');
  console.log(`Checking ${CONFIG.destinations.length} destinations`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  let allDeals = [];

  // Scrape Google Hotels for each destination
  for (const dest of CONFIG.destinations) {
    console.log(`\nSearching hotels in ${dest.name}...`);
    const deals = await scrapeGoogleHotels(page, dest);
    console.log(`  Found ${deals.length} deals`);
    allDeals = allDeals.concat(deals);

    // Rate limiting
    await page.waitForTimeout(3000 + Math.random() * 2000);
  }

  // Also check deal aggregator pages
  console.log('\nChecking deal aggregator pages...');
  const aggregatorDeals = await scrapeHotelDealPages(page);
  allDeals = allDeals.concat(aggregatorDeals);

  await browser.close();

  // Deduplicate and sort by best discount
  const uniqueDeals = deduplicateDeals(allDeals);
  const sortedDeals = uniqueDeals.sort((a, b) => (b.percentOff || 0) - (a.percentOff || 0));

  // Take top 20 hotel deals
  const topDeals = sortedDeals.slice(0, 20);

  console.log(`\nFound ${topDeals.length} great hotel deals!`);

  return topDeals;
}

/**
 * Remove duplicate deals
 */
function deduplicateDeals(deals) {
  const seen = new Set();
  return deals.filter(deal => {
    const key = `${deal.hotelName}-${deal.location}-${deal.pricePerNight}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Save deals to JSON file
 */
async function saveDeals(deals) {
  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    generated: new Date().toISOString(),
    count: deals.length,
    deals: deals
  };

  const filePath = path.join(outputDir, 'hotels.json');
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
  console.log(`Saved ${deals.length} hotel deals to ${filePath}`);

  return filePath;
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

  scrapeHotelDeals()
    .then(deals => saveDeals(deals))
    .then(() => {
      console.log('Hotel scraping complete!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Scraper failed:', err);
      process.exit(1);
    });
}

module.exports = { scrapeHotelDeals, saveDeals, generateExpediaHotelLink };
