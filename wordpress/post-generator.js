/**
 * WordPress Post Generator & Publisher
 * Generates formatted blog posts from scraped deals and publishes via REST API
 *
 * Environment variables required:
 * - WORDPRESS_URL: e.g., https://etravelogs.com
 * - WORDPRESS_USERNAME: WordPress username
 * - WORDPRESS_APP_PASSWORD: Application password (generate in WP Admin → Users → Profile)
 * - WORDPRESS_FLIGHT_CATEGORY_ID: Category ID for flight deals (e.g., 39)
 * - WORDPRESS_HOTEL_CATEGORY_ID: Category ID for hotel deals
 */

const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

// WordPress configuration from environment
const WP_CONFIG = {
  url: process.env.WORDPRESS_URL || 'https://etravelogs.com',
  username: process.env.WORDPRESS_USERNAME,
  appPassword: process.env.WORDPRESS_APP_PASSWORD,
  flightCategoryId: parseInt(process.env.WORDPRESS_FLIGHT_CATEGORY_ID) || 39,
  hotelCategoryId: parseInt(process.env.WORDPRESS_HOTEL_CATEGORY_ID) || 40
};

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

/**
 * Publish a post to WordPress via REST API
 */
async function publishToWordPress(post, categoryId, postType = 'flight') {
  if (!WP_CONFIG.username || !WP_CONFIG.appPassword) {
    console.log(`Skipping WordPress publish - credentials not configured`);
    return null;
  }

  const apiUrl = `${WP_CONFIG.url}/wp-json/wp/v2/posts`;
  const auth = Buffer.from(`${WP_CONFIG.username}:${WP_CONFIG.appPassword}`).toString('base64');

  // First, check if a post with this slug already exists today
  const existingCheck = await fetch(`${apiUrl}?slug=${post.slug}&status=any`, {
    headers: { 'Authorization': `Basic ${auth}` }
  });
  const existingPosts = await existingCheck.json();

  if (existingPosts.length > 0) {
    console.log(`Post already exists: ${post.title} (ID: ${existingPosts[0].id})`);
    // Update existing post instead of creating duplicate
    const updateUrl = `${apiUrl}/${existingPosts[0].id}`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: post.content,
        excerpt: post.excerpt
      })
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update post: ${error}`);
    }

    const updated = await updateResponse.json();
    console.log(`Updated existing post: ${updated.link}`);
    return updated;
  }

  // Create new post
  const postData = {
    title: post.title,
    slug: post.slug,
    content: post.content,
    excerpt: post.excerpt,
    status: 'publish',
    categories: [categoryId],
    tags: [] // Tags would need to be created/looked up first
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(postData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create post: ${error}`);
  }

  const created = await response.json();
  console.log(`Published new post: ${created.link}`);
  return created;
}

/**
 * Generate posts and publish to WordPress
 */
async function generateAndPublish() {
  const outputDir = path.join(__dirname, '..', 'output');

  // Load deals
  let flightDeals = [];
  let hotelDeals = [];

  try {
    const flightData = JSON.parse(fs.readFileSync(path.join(outputDir, 'flights.json'), 'utf8'));
    flightDeals = flightData.deals || [];
    console.log(`Loaded ${flightDeals.length} flight deals`);
  } catch (e) {
    console.log('No flight deals found');
  }

  try {
    const hotelData = JSON.parse(fs.readFileSync(path.join(outputDir, 'hotels.json'), 'utf8'));
    hotelDeals = hotelData.deals || [];
    console.log(`Loaded ${hotelDeals.length} hotel deals`);
  } catch (e) {
    console.log('No hotel deals found');
  }

  const today = new Date();
  const results = { flights: null, hotels: null };

  // Generate and publish flight deals post (if we have deals)
  if (flightDeals.length > 0) {
    const flightPost = generateFlightDealsPost(flightDeals, today);
    console.log(`\nPublishing: ${flightPost.title}`);
    try {
      results.flights = await publishToWordPress(flightPost, WP_CONFIG.flightCategoryId, 'flight');
    } catch (err) {
      console.error('Failed to publish flight deals:', err.message);
    }
  }

  // Generate and publish hotel deals post (if we have deals)
  if (hotelDeals.length > 0) {
    const hotelPost = generateHotelDealsPost(hotelDeals, today);
    console.log(`\nPublishing: ${hotelPost.title}`);
    try {
      results.hotels = await publishToWordPress(hotelPost, WP_CONFIG.hotelCategoryId, 'hotel');
    } catch (err) {
      console.error('Failed to publish hotel deals:', err.message);
    }
  }

  console.log('\n=== Publishing Complete ===');
  if (results.flights) console.log(`Flight deals: ${results.flights.link}`);
  if (results.hotels) console.log(`Hotel deals: ${results.hotels.link}`);

  return results;
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--publish')) {
    // Generate and publish to WordPress
    generateAndPublish()
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
  } else {
    // Just generate local files (original behavior)
    generatePosts()
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
  }
}

module.exports = { generateFlightDealsPost, generateHotelDealsPost, generatePosts, generateAndPublish, publishToWordPress };
