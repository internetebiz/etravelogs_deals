/**
 * Run All Scrapers (Optimized with Day-Based Rotation)
 *
 * OPTIMIZATION: Uses day-based rotation to spread workload across the week
 * - Each day processes a subset of origins/destinations
 * - Target runtime: 10-15 minutes (down from 100+ minutes)
 * - Full coverage achieved over 7 days with deal merging
 */

const fs = require('fs');
const path = require('path');
const { scrapeFlightDeals, saveDeals: saveFlightDeals } = require('./flight-deals');
const { scrapeHotelDeals, saveDeals: saveHotelDeals } = require('./hotel-deals');

async function runAllScrapers() {
  const startTime = Date.now();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = new Date().getDay();

  console.log('='.repeat(60));
  console.log('eTravelogs Daily Deal Scraper (Optimized)');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Day: ${dayNames[dayOfWeek]} (rotation day ${dayOfWeek})`);
  console.log('='.repeat(60));
  console.log('NOTE: Using day-based rotation for efficient runtime');
  console.log('      Full coverage achieved over 7 days with deal merging');

  // Run flight scraper
  console.log('\n[FLIGHTS]');
  console.log('-'.repeat(40));
  const flightStart = Date.now();
  let flightDeals = [];
  try {
    flightDeals = await scrapeFlightDeals();
    await saveFlightDeals(flightDeals);
    console.log(`Flight scraper completed in ${Math.round((Date.now() - flightStart) / 1000)}s`);
  } catch (err) {
    console.error('Flight scraper failed:', err.message);
  }

  // Run hotel scraper
  console.log('\n[HOTELS]');
  console.log('-'.repeat(40));
  const hotelStart = Date.now();
  let hotelDeals = [];
  try {
    hotelDeals = await scrapeHotelDeals();
    await saveHotelDeals(hotelDeals);
    console.log(`Hotel scraper completed in ${Math.round((Date.now() - hotelStart) / 1000)}s`);
  } catch (err) {
    console.error('Hotel scraper failed:', err.message);
  }

  // Create combined output
  const outputDir = path.join(__dirname, '..', 'output');
  const combined = {
    generated: new Date().toISOString(),
    rotationDay: dayOfWeek,
    summary: {
      totalFlightDeals: flightDeals.length,
      totalHotelDeals: hotelDeals.length,
      bestFlightDeal: flightDeals[0] || null,
      bestHotelDeal: hotelDeals[0] || null
    },
    flights: flightDeals,
    hotels: hotelDeals
  };

  fs.writeFileSync(
    path.join(outputDir, 'deals.json'),
    JSON.stringify(combined, null, 2)
  );

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Flight deals found: ${flightDeals.length}`);
  console.log(`Hotel deals found: ${hotelDeals.length}`);
  console.log(`Output saved to: ${path.join(outputDir, 'deals.json')}`);
  console.log(`Total runtime: ${totalTime}s (${Math.round(totalTime / 60)} minutes)`);

  if (flightDeals.length > 0 && flightDeals[0].originName) {
    console.log(`\nBest flight deal: ${flightDeals[0].originName} -> ${flightDeals[0].destinationName}`);
    console.log(`   Price: $${flightDeals[0].price} (${flightDeals[0].percentOff}% off)`);
  }

  if (hotelDeals.length > 0 && hotelDeals[0].hotelName) {
    console.log(`\nBest hotel deal: ${hotelDeals[0].hotelName} in ${hotelDeals[0].location}`);
    console.log(`   Price: $${hotelDeals[0].pricePerNight}/night (${hotelDeals[0].percentOff}% off)`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  return combined;
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

  runAllScrapers()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Scraper failed:', err);
      process.exit(1);
    });
}

module.exports = { runAllScrapers };
