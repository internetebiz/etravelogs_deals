/**
 * Flight Deals Scraper for eTravelogs
 * Uses Playwright to scrape Google Flights for deals from top 10 US cities
 *
 * Strategy: Search for flights 2-3 months out to find best deals
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

  // Top 10 US origin cities
  originCities: [
    { code: 'JFK', name: 'New York (JFK)', metro: 'NYC' },
    { code: 'LAX', name: 'Los Angeles', metro: 'LAX' },
    { code: 'SFO', name: 'San Francisco', metro: 'SFO' },
    { code: 'ORD', name: 'Chicago', metro: 'CHI' },
    { code: 'MIA', name: 'Miami', metro: 'MIA' },
    { code: 'DFW', name: 'Dallas', metro: 'DFW' },
    { code: 'BOS', name: 'Boston', metro: 'BOS' },
    { code: 'SEA', name: 'Seattle', metro: 'SEA' },
    { code: 'DEN', name: 'Denver', metro: 'DEN' },
    { code: 'ATL', name: 'Atlanta', metro: 'ATL' }
  ],

  // Popular international destinations
  destinations: [
    { code: 'PAR', name: 'Paris', country: 'France' },
    { code: 'LON', name: 'London', country: 'UK' },
    { code: 'TYO', name: 'Tokyo', country: 'Japan' },
    { code: 'ROM', name: 'Rome', country: 'Italy' },
    { code: 'BCN', name: 'Barcelona', country: 'Spain' },
    { code: 'CUN', name: 'Cancun', country: 'Mexico' },
    { code: 'LIS', name: 'Lisbon', country: 'Portugal' },
    { code: 'DUB', name: 'Dublin', country: 'Ireland' },
    { code: 'AMS', name: 'Amsterdam', country: 'Netherlands' },
    { code: 'ICN', name: 'Seoul', country: 'South Korea' },
    { code: 'BKK', name: 'Bangkok', country: 'Thailand' },
    { code: 'SIN', name: 'Singapore', country: 'Singapore' }
  ],

  // Typical prices for comparison (used to calculate % off)
  typicalPrices: {
    'PAR': 800, 'LON': 750, 'TYO': 1200, 'ROM': 850,
    'BCN': 700, 'CUN': 400, 'LIS': 650, 'DUB': 600,
    'AMS': 700, 'ICN': 1100, 'BKK': 900, 'SIN': 1000
  },

  // Day-based rotation: spread cities across days to stay under 15 min
  // Each day processes 2-3 origin cities with 6 destinations
  dayRotation: {
    0: { origins: [0, 1], destinations: [0, 1, 2, 3, 4, 5] },       // Sunday: JFK, LAX -> Europe
    1: { origins: [2, 3], destinations: [0, 1, 2, 3, 4, 5] },       // Monday: SFO, ORD -> Europe
    2: { origins: [4, 5], destinations: [6, 7, 8, 9, 10, 11] },     // Tuesday: MIA, DFW -> Asia/Other
    3: { origins: [6, 7], destinations: [6, 7, 8, 9, 10, 11] },     // Wednesday: BOS, SEA -> Asia/Other
    4: { origins: [8, 9], destinations: [0, 1, 2, 3, 4, 5] },       // Thursday: DEN, ATL -> Europe
    5: { origins: [0, 1, 2], destinations: [6, 7, 8, 9, 10, 11] },  // Friday: Top 3 -> Asia
    6: { origins: [0, 1, 2, 3, 4], destinations: [0, 1, 2, 5] }     // Saturday: Top 5 -> Top 4 destinations
  }
};

/**
 * Generate Expedia deeplink for a flight search
 * Note: Expedia expects colons, commas, and slashes unencoded in leg parameters
 */
function generateExpediaLink(origin, dest, departDate, returnDate, passengers = 1) {
  const baseUrl = 'https://www.expedia.com/Flights-Search';
  const departStr = format(departDate, 'MM/dd/yyyy');
  const returnStr = format(returnDate, 'MM/dd/yyyy');

  // Build URL manually - Expedia expects special chars unencoded in leg params
  const leg1 = `from:${origin},to:${dest},departure:${departStr}TANYT`;
  const leg2 = `from:${dest},to:${origin},departure:${returnStr}TANYT`;
  const passengersParam = `adults:${passengers}`;
  const affcid = `US.DIRECT.PHG.${CONFIG.expediaPublisherId}.${CONFIG.expediaAffiliateTag}`;

  return `${baseUrl}?trip=roundtrip&leg1=${leg1}&leg2=${leg2}&passengers=${passengersParam}&AFFCID=${affcid}`;
}

/**
 * Scrape Google Flights for a specific route
 */
async function scrapeGoogleFlights(page, origin, destination) {
  const deals = [];

  // Calculate travel dates (2-3 months out, 7-day trip)
  const departDate = addMonths(new Date(), 2);
  const returnDate = addDays(departDate, 7);

  const departStr = format(departDate, 'yyyy-MM-dd');
  const returnStr = format(returnDate, 'yyyy-MM-dd');

  // Google Flights URL format
  const url = `https://www.google.com/travel/flights/search?tfs=CBwQAhojEgoyMDI2LTA0LTAxagcIARIDJHtvcmlnaW59cgcIARIDJHtkZXN0fRojEgoyMDI2LTA0LTA4agcIARIDJHtkZXN0fXIHCAESAyR7b3JpZ2lufUABSAFwAYIBCwj___________8BmAEB`
    .replace('${origin}', origin.code)
    .replace('${dest}', destination.code);

  try {
    // Use a simpler approach: construct the search URL directly
    const searchUrl = `https://www.google.com/travel/flights?q=flights%20from%20${encodeURIComponent(origin.name)}%20to%20${encodeURIComponent(destination.name)}`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000); // Let prices load

    // Try to find price elements
    const priceElements = await page.$$('span[data-gs], .gws-flights-results__price, [aria-label*="$"]');

    // Extract the lowest price shown
    let lowestPrice = null;
    for (const el of priceElements) {
      const text = await el.textContent();
      const priceMatch = text.match(/\$(\d+)/);
      if (priceMatch) {
        const price = parseInt(priceMatch[1]);
        if (!lowestPrice || price < lowestPrice) {
          lowestPrice = price;
        }
      }
    }

    if (lowestPrice) {
      const typicalPrice = CONFIG.typicalPrices[destination.code] || 800;
      const percentOff = Math.round(((typicalPrice - lowestPrice) / typicalPrice) * 100);

      if (percentOff > 15) { // Only include deals with >15% off
        deals.push({
          origin: origin.code,
          originName: origin.name,
          destination: destination.code,
          destinationName: destination.name,
          destinationCountry: destination.country,
          price: lowestPrice,
          typicalPrice: typicalPrice,
          percentOff: percentOff,
          departDate: departStr,
          returnDate: returnStr,
          tripLength: '7 days',
          source: 'Google Flights',
          scrapedAt: new Date().toISOString(),
          expediaLink: generateExpediaLink(origin.code, destination.code, departDate, returnDate)
        });
      }
    }
  } catch (error) {
    console.error(`Error scraping ${origin.code} → ${destination.code}:`, error.message);
  }

  return deals;
}

/**
 * Alternative: Use Google Flights Explore feature for deals
 */
async function scrapeGoogleFlightsExplore(page, origin) {
  const deals = [];

  try {
    // Google Flights Explore shows deals from a city
    const exploreUrl = `https://www.google.com/travel/explore?tfs=CBwQAxoJagcIARIDJHtvcmlnaW59QAFIAXABggELCP___________wGYAQI&tfu=EgYIAhAAGAA&hl=en&gl=us&curr=USD`
      .replace('${origin}', origin.code);

    await page.goto(`https://www.google.com/travel/explore?tfs=CBwQAxoJagcIARID${origin.code}QAFIAXABggELCP___________wGYAQI`,
      { waitUntil: 'domcontentloaded', timeout: 25000 });

    await page.waitForTimeout(3000); // Let the map and prices load

    // Look for destination cards with prices
    const cards = await page.$$('[data-ved] [role="button"]');

    for (const card of cards.slice(0, 10)) { // Limit to top 10 shown
      try {
        const text = await card.textContent();
        const priceMatch = text.match(/\$(\d+)/);
        const cityMatch = text.match(/([A-Za-z\s]+)\$/);

        if (priceMatch && cityMatch) {
          const price = parseInt(priceMatch[1]);
          const city = cityMatch[1].trim();

          deals.push({
            origin: origin.code,
            originName: origin.name,
            destination: city,
            price: price,
            source: 'Google Flights Explore',
            scrapedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    console.error(`Error exploring from ${origin.code}:`, error.message);
  }

  return deals;
}

/**
 * Get today's rotation config for day-based scraping
 * This spreads the workload across the week to stay under 15 minutes per run
 */
function getTodayRotation() {
  const dayOfWeek = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  return CONFIG.dayRotation[dayOfWeek];
}

/**
 * Main scraper function
 * Uses day-based rotation to process a subset of routes each day
 * Full coverage achieved over a week, each day runs in ~10-15 minutes
 */
async function scrapeFlightDeals() {
  const rotation = getTodayRotation();
  const todaysOrigins = rotation.origins.map(i => CONFIG.originCities[i]);
  const todaysDestinations = rotation.destinations.map(i => CONFIG.destinations[i]);
  const dayOfWeek = new Date().getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  console.log('Starting flight deals scraper (optimized day rotation)...');
  console.log(`Today is ${dayNames[dayOfWeek]} - Day ${dayOfWeek} rotation`);
  console.log(`Scraping from ${todaysOrigins.length} origin cities: ${todaysOrigins.map(o => o.code).join(', ')}`);
  console.log(`Looking at ${todaysDestinations.length} destinations: ${todaysDestinations.map(d => d.code).join(', ')}`);
  console.log(`Total searches today: ${todaysOrigins.length * todaysDestinations.length} routes`);

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

  // Strategy 1: Scrape today's routes (reduced set based on day rotation)
  for (const origin of todaysOrigins) {
    console.log(`\nSearching from ${origin.name}...`);

    for (const dest of todaysDestinations) {
      console.log(`  -> ${dest.name}...`);
      const deals = await scrapeGoogleFlights(page, origin, dest);
      allDeals = allDeals.concat(deals);

      // Reduced rate limiting - 1-2 seconds instead of 2-4
      await page.waitForTimeout(1000 + Math.random() * 1000);
    }
  }

  // Strategy 2: Check Google Flights Explore for today's origins only (max 2)
  console.log('\nChecking Google Flights Explore for additional deals...');
  for (const origin of todaysOrigins.slice(0, 2)) {
    const exploreDeals = await scrapeGoogleFlightsExplore(page, origin);
    allDeals = allDeals.concat(exploreDeals);
    await page.waitForTimeout(2000);
  }

  await browser.close();

  // Load existing deals from previous days (if any) and merge
  const existingDeals = loadExistingDeals();
  allDeals = allDeals.concat(existingDeals);

  // Deduplicate and sort by best deal
  const uniqueDeals = deduplicateDeals(allDeals);
  const sortedDeals = uniqueDeals.sort((a, b) => (b.percentOff || 0) - (a.percentOff || 0));

  // Take top 20 deals
  const topDeals = sortedDeals.slice(0, 20);

  console.log(`\nFound ${topDeals.length} great deals (including merged from previous runs)!`);

  return topDeals;
}

/**
 * Load existing deals from previous runs (for merging across days)
 * Only includes deals from the last 7 days
 */
function loadExistingDeals() {
  try {
    const filePath = path.join(__dirname, '..', 'output', 'flights.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Filter to only include deals scraped within last 7 days
      const recentDeals = (data.deals || []).filter(deal => {
        const scrapedAt = new Date(deal.scrapedAt);
        return scrapedAt > sevenDaysAgo;
      });

      console.log(`Loaded ${recentDeals.length} existing deals from previous runs`);
      return recentDeals;
    }
  } catch (err) {
    console.log('No existing deals to merge (first run or file error)');
  }
  return [];
}

/**
 * Remove duplicate deals
 */
function deduplicateDeals(deals) {
  const seen = new Set();
  return deals.filter(deal => {
    const key = `${deal.origin}-${deal.destination}-${deal.price}`;
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

  const filePath = path.join(outputDir, 'flights.json');
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
  console.log(`Saved ${deals.length} flight deals to ${filePath}`);

  return filePath;
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

  scrapeFlightDeals()
    .then(deals => saveDeals(deals))
    .then(() => {
      console.log('Flight scraping complete!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Scraper failed:', err);
      process.exit(1);
    });
}

module.exports = { scrapeFlightDeals, saveDeals, generateExpediaLink };
