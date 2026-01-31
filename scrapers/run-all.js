/**
 * Run All Scrapers
 * Combines flight and hotel deals into a single output
 */

const fs = require('fs');
const path = require('path');
const { scrapeFlightDeals, saveDeals: saveFlightDeals } = require('./flight-deals');
const { scrapeHotelDeals, saveDeals: saveHotelDeals } = require('./hotel-deals');

async function runAllScrapers() {
  console.log('='.repeat(60));
  console.log('eTravelogs Daily Deal Scraper');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Run flight scraper
  console.log('\n📍 FLIGHT DEALS');
  console.log('-'.repeat(40));
  let flightDeals = [];
  try {
    flightDeals = await scrapeFlightDeals();
    await saveFlightDeals(flightDeals);
  } catch (err) {
    console.error('Flight scraper failed:', err.message);
  }

  // Run hotel scraper
  console.log('\n🏨 HOTEL DEALS');
  console.log('-'.repeat(40));
  let hotelDeals = [];
  try {
    hotelDeals = await scrapeHotelDeals();
    await saveHotelDeals(hotelDeals);
  } catch (err) {
    console.error('Hotel scraper failed:', err.message);
  }

  // Create combined output
  const outputDir = path.join(__dirname, '..', 'output');
  const combined = {
    generated: new Date().toISOString(),
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

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`✈️  Flight deals found: ${flightDeals.length}`);
  console.log(`🏨 Hotel deals found: ${hotelDeals.length}`);
  console.log(`📁 Output saved to: ${path.join(outputDir, 'deals.json')}`);

  if (flightDeals.length > 0) {
    console.log(`\n🔥 Best flight deal: ${flightDeals[0].originName} → ${flightDeals[0].destinationName}`);
    console.log(`   Price: $${flightDeals[0].price} (${flightDeals[0].percentOff}% off)`);
  }

  if (hotelDeals.length > 0) {
    console.log(`\n🔥 Best hotel deal: ${hotelDeals[0].hotelName} in ${hotelDeals[0].location}`);
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
