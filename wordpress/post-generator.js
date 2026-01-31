/**
 * WordPress Post Generator
 * Generates formatted blog posts from scraped deals
 *
 * Output: HTML content ready for WordPress REST API or manual copy-paste
 */

const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

/**
 * Generate a flight deals blog post
 */
function generateFlightDealsPost(deals, date = new Date()) {
  const dateStr = format(date, 'MMMM d, yyyy');
  const shortDate = format(date, 'MMM d');

  const title = `Today's Best Flight Deals – ${dateStr}`;
  const slug = `todays-best-flight-deals-${format(date, 'yyyy-MM-dd')}`;

  let content = `
<p>Looking for unbeatable flight deals today? Here are the top offers verified as of ${dateStr}:</p>

<!-- wp:heading {"level":2} -->
<h2>🔥 Today's Top Flight Deals</h2>
<!-- /wp:heading -->

`;

  if (deals.length === 0) {
    content += `<p>Check back later - we're still searching for today's best deals!</p>`;
  } else {
    deals.forEach((deal, index) => {
      const emoji = index === 0 ? '🏆' : (index < 3 ? '✈️' : '🎫');

      content += `
<!-- wp:group {"className":"deal-card"} -->
<div class="wp-block-group deal-card" style="background: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">

<h3>${emoji} ${deal.originName} → ${deal.destinationName}, ${deal.destinationCountry}</h3>

<p><strong>💰 Price: $${deal.price}</strong> ${deal.percentOff > 0 ? `<span style="color: green;">(${deal.percentOff}% off typical $${deal.typicalPrice})</span>` : ''}</p>

<p>📅 Sample dates: ${deal.departDate} to ${deal.returnDate} (${deal.tripLength})</p>

<p>
  <a href="${deal.expediaLink}" target="_blank" rel="nofollow sponsored" style="display: inline-block; padding: 10px 20px; background: #e53e3e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
    Book on Expedia →
  </a>
</p>

</div>
<!-- /wp:group -->
`;
    });
  }

  content += `
<!-- wp:heading {"level":2} -->
<h2>💡 Tips to Get These Prices</h2>
<!-- /wp:heading -->

<ul>
  <li>Prices change frequently - book quickly when you see a deal</li>
  <li>Use incognito mode to avoid price tracking</li>
  <li>Be flexible with dates (±3 days can save hundreds)</li>
  <li>Check our <a href="https://etravelogs.com/miles-points-vs-cash-calculator/">Miles vs Cash Calculator</a> to see if points are better</li>
</ul>

<!-- wp:heading {"level":2} -->
<h2>🧮 Should You Use Miles Instead?</h2>
<!-- /wp:heading -->

<p>Before booking with cash, check if your miles offer better value:</p>

[miles_calculator]

<p>Subscribe to our newsletter to get deals like these delivered to your inbox!</p>

<p><em>Deals found on ${dateStr}. Prices subject to change. Some links are affiliate links.</em></p>
`;

  return {
    title,
    slug,
    content,
    excerpt: `Today's verified flight deals from ${deals.length} routes. Best deal: ${deals[0]?.originName || 'Check inside'} to ${deals[0]?.destinationName || 'various'} for $${deals[0]?.price || 'TBD'}.`,
    categories: ['Flight Deals', 'Daily Deals'],
    tags: deals.map(d => d.destinationName).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5)
  };
}

/**
 * Generate a hotel deals blog post
 */
function generateHotelDealsPost(deals, date = new Date()) {
  const dateStr = format(date, 'MMMM d, yyyy');

  const title = `Today's Best Hotel Deals – ${dateStr}`;
  const slug = `todays-best-hotel-deals-${format(date, 'yyyy-MM-dd')}`;

  let content = `
<p>Looking for unbeatable hotel deals today? Here are the top properties with at least 25% off, verified as of ${dateStr}:</p>

<!-- wp:heading {"level":2} -->
<h2>🏨 Today's Top Hotel Deals</h2>
<!-- /wp:heading -->

`;

  if (deals.length === 0) {
    content += `<p>Check back later - we're still searching for today's best deals!</p>`;
  } else {
    deals.forEach((deal, index) => {
      const emoji = index === 0 ? '🏆' : (index < 3 ? '🏨' : '🛏️');
      const stars = deal.rating ? '⭐'.repeat(Math.min(Math.floor(deal.rating), 5)) : '';

      content += `
<!-- wp:group {"className":"deal-card"} -->
<div class="wp-block-group deal-card" style="background: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">

<h3>${emoji} ${deal.hotelName}</h3>
<p>📍 ${deal.location}, ${deal.country} ${stars}</p>

<p><strong>💰 $${deal.pricePerNight}/night</strong> ${deal.percentOff > 0 ? `<span style="color: green;">(${deal.percentOff}% off ${deal.originalPrice ? '$' + deal.originalPrice : 'regular price'})</span>` : ''}</p>

<p>📅 Sample stay: ${deal.checkinDate} - ${deal.checkoutDate} (${deal.nights} nights)</p>

<p>
  <a href="${deal.expediaSearchLink}" target="_blank" rel="nofollow sponsored" style="display: inline-block; padding: 10px 20px; background: #2b6cb0; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
    Check Availability →
  </a>
</p>

</div>
<!-- /wp:group -->
`;
    });
  }

  content += `
<!-- wp:heading {"level":2} -->
<h2>💡 Hotel Booking Tips</h2>
<!-- /wp:heading -->

<ul>
  <li>Book directly sometimes offers perks (breakfast, upgrades)</li>
  <li>Check if your credit card offers hotel status matches</li>
  <li>Use our <a href="https://etravelogs.com/miles-points-vs-cash-calculator/">Calculator</a> to value hotel points</li>
  <li>Look for "member prices" - often requires free signup</li>
</ul>

<p>Subscribe to our newsletter for weekly hotel deals!</p>

<p><em>Deals found on ${dateStr}. Prices subject to change. Some links are affiliate links.</em></p>
`;

  return {
    title,
    slug,
    content,
    excerpt: `Today's verified hotel deals in ${deals.length} destinations. Best deal: ${deals[0]?.hotelName || 'Various'} for $${deals[0]?.pricePerNight || 'TBD'}/night.`,
    categories: ['Hotel Deals', 'Daily Deals'],
    tags: deals.map(d => d.location).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5)
  };
}

/**
 * Generate both posts and save to output folder
 */
async function generatePosts() {
  const outputDir = path.join(__dirname, '..', 'output');

  // Load deals
  let flightDeals = [];
  let hotelDeals = [];

  try {
    const flightData = JSON.parse(fs.readFileSync(path.join(outputDir, 'flights.json'), 'utf8'));
    flightDeals = flightData.deals || [];
  } catch (e) {
    console.log('No flight deals found');
  }

  try {
    const hotelData = JSON.parse(fs.readFileSync(path.join(outputDir, 'hotels.json'), 'utf8'));
    hotelDeals = hotelData.deals || [];
  } catch (e) {
    console.log('No hotel deals found');
  }

  const today = new Date();

  // Generate posts
  const flightPost = generateFlightDealsPost(flightDeals, today);
  const hotelPost = generateHotelDealsPost(hotelDeals, today);

  // Save to output folder
  const postsDir = path.join(outputDir, 'posts');
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(postsDir, 'flight-deals-post.json'),
    JSON.stringify(flightPost, null, 2)
  );

  fs.writeFileSync(
    path.join(postsDir, 'hotel-deals-post.json'),
    JSON.stringify(hotelPost, null, 2)
  );

  // Also save raw HTML for easy copy-paste
  fs.writeFileSync(
    path.join(postsDir, 'flight-deals-content.html'),
    flightPost.content
  );

  fs.writeFileSync(
    path.join(postsDir, 'hotel-deals-content.html'),
    hotelPost.content
  );

  console.log('Generated WordPress posts:');
  console.log(`  - Flight deals: ${flightPost.title}`);
  console.log(`  - Hotel deals: ${hotelPost.title}`);
  console.log(`\nOutput saved to: ${postsDir}`);

  return { flightPost, hotelPost };
}

// Run if called directly
if (require.main === module) {
  generatePosts()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { generateFlightDealsPost, generateHotelDealsPost, generatePosts };
