# eTravelogs Deal Automation System

Automated flight and hotel deal scraping system for [eTravelogs.com](https://etravelogs.com). Runs daily via GitHub Actions (free) to keep your travel deals fresh.

## Features

- 🛫 **Flight Deal Scraper** - Scrapes Google Flights from 10 US cities to 12 popular destinations
- 🏨 **Hotel Deal Scraper** - Finds hotel discounts (25%+ off) in 20 destinations
- 🔗 **Expedia Affiliate Links** - Auto-generates tracked affiliate links
- 📝 **WordPress Post Generator** - Creates ready-to-publish blog posts
- 🧮 **Slim Miles Calculator** - Embeddable calculator with 73 CPP valuations
- 🎫 **GetYourGuide Tool** - Semi-automated affiliate link generator
- ⏰ **Daily Automation** - GitHub Actions runs at 6 AM EST

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/internetebiz/etravelogs_deals.git
cd etravelogs_deals
npm install
npx playwright install chromium
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your affiliate credentials
```

### 3. Run Scrapers

```bash
# Run all scrapers
npm run scrape:all

# Run individually
npm run scrape:flights
npm run scrape:hotels

# Generate WordPress posts from scraped data
npm run generate:wp-post
```

## Directory Structure

```
etravelogs_deals/
├── .github/workflows/
│   └── daily-scraper.yml     # GitHub Actions automation
├── scrapers/
│   ├── flight-deals.js       # Google Flights scraper
│   ├── hotel-deals.js        # Google Hotels scraper
│   └── run-all.js            # Combined runner
├── output/
│   ├── deals.json            # Combined output
│   ├── flights.json          # Flight deals
│   ├── hotels.json           # Hotel deals
│   └── posts/                # Generated WordPress posts
├── calculator/
│   ├── points-valuations.json    # 73 CPP rates
│   ├── slim-calculator.html      # Standalone calculator
│   └── wordpress-embed.html      # WordPress-ready version
├── wordpress/
│   └── post-generator.js     # Creates blog posts from deals
├── tools/
│   └── gyg-link-generator.js # GetYourGuide helper
└── package.json
```

## GitHub Actions Setup

### 1. Add Repository Secrets

Go to Settings → Secrets and variables → Actions → New repository secret:

| Secret Name | Value |
|-------------|-------|
| `EXPEDIA_AFFILIATE_TAG` | `etravelogs` |
| `EXPEDIA_PUBLISHER_ID` | `1011l387199` |
| `N8N_WEBHOOK_URL` | (optional) Your n8n webhook for newsletters |

### 2. Enable Actions

The workflow runs automatically at 6 AM EST daily. You can also trigger manually:
- Go to Actions tab
- Select "Daily Deal Scraper"
- Click "Run workflow"

## Usage Guide

### GetYourGuide Link Generator

For your Bligence workflow, generate GYG affiliate links:

```bash
# Search for activities
node tools/gyg-link-generator.js "tokyo"

# Multiple destinations
node tools/gyg-link-generator.js --list "paris,rome,barcelona"

# Format for Bligence (copy-paste ready)
node tools/gyg-link-generator.js --format bligence "barcelona day trips"

# Other formats: markdown, html, json
node tools/gyg-link-generator.js --format html "london tours"
```

Output is saved to `output/gyg-[destination].txt`

### Embedding the Miles Calculator

**Option 1: WordPress Custom HTML Block**
1. Copy contents of `calculator/wordpress-embed.html`
2. In WordPress, add a Custom HTML block
3. Paste the code
4. Publish

**Option 2: Shortcode (requires Code Snippets plugin)**
1. Install Code Snippets plugin
2. Create snippet that outputs the HTML
3. Use `[miles_calculator]` in your posts

### Manually Posting Deals

After scraping runs:

1. Open `output/posts/flight-deals-content.html`
2. Copy the HTML content
3. In WordPress, create new post
4. Use the generated title from `flight-deals-post.json`
5. Paste content in block editor
6. Publish!

## Affiliate Configuration

### Expedia
- Affiliate Tag: `etravelogs`
- Publisher ID: `1011l387199`
- Deep link format included automatically

### GetYourGuide
- Use the link generator tool
- Links go through your partner dashboard

### Future: Booking.com, Skyscanner
When you get approved, add credentials to `.env` and update scraper link generators.

## ⚠️ Known Issues (February 2026)

**Status: WordPress auto-publishing is DISABLED due to critical data quality issues.**

### Critical Issues

| Issue | Description | Impact |
|-------|-------------|--------|
| **$1 Flight Prices** | Scraper returns $1 for all flights instead of real prices | Misleading/inaccurate data |
| **Broken Expedia Links** | URLs are double-encoded (`%253A` instead of `:`) causing "wrong turn" errors | Links don't work |
| **Hotel Price Mismatch** | Scraped prices ($104/night) don't match Expedia actual prices ($262+/night) | Misrepresentation |
| **Generic Hotel Links** | Links go to city search, not specific hotel | Poor user experience |

### Root Causes

1. **Google Flights/Hotels Anti-Scraping**
   - Heavy JavaScript rendering
   - Dynamic content that changes frequently
   - Anti-bot protections
   - DOM structure changes without notice

2. **Price Extraction Failures**
   - Selectors may be outdated
   - Prices load asynchronously and may not be captured
   - Default/fallback values ($1) being used when extraction fails

3. **URL Encoding Issues**
   - `URLSearchParams` double-encodes special characters
   - Expedia expects specific URL format with unencoded `:`, `,`, `/`

### What's Disabled

- ❌ Daily scheduled runs (cron)
- ❌ WordPress auto-publishing
- ✅ Manual workflow runs (for debugging)
- ✅ Artifact uploads (for inspection)

### Recommended Alternatives

Instead of scraping, consider:

1. **Deal Aggregator APIs**
   - Skyscanner API (requires partnership)
   - Amadeus API (requires approval)
   - Travelport API

2. **RSS Feeds from Deal Sites**
   - The Points Guy deals feed
   - Secret Flying
   - Scott's Cheap Flights (if you have subscription)

3. **Manual Curation**
   - Continue posting deals manually as before
   - Use the WordPress post generator for formatting only
   - Verify prices before publishing

4. **Affiliate Network Deep Links**
   - Use Expedia's official deep link generator
   - CJ Affiliate link builder
   - Avoid programmatic link construction

### To Re-enable Automation

Before re-enabling, the following must be fixed:

1. [ ] Flight price extraction returning accurate prices
2. [ ] Hotel price extraction matching actual booking prices
3. [ ] Expedia deep links working correctly
4. [ ] Hotel links going to specific properties
5. [ ] Add price validation (reject obviously wrong prices like $1)
6. [ ] Test full workflow end-to-end before enabling schedule

---

## Troubleshooting

### Scraper Times Out
- Google may be rate limiting. Try increasing delays in scraper configs.
- Run during off-peak hours.

### No Deals Found
- Check if Google Flights/Hotels changed their HTML structure
- Try running with `headless: false` to debug visually

### GitHub Actions Failing
- Check that secrets are set correctly
- View workflow logs in Actions tab

## Newsletter Integration

The system can trigger your n8n workflow when new deals are found:

1. Set `N8N_WEBHOOK_URL` secret in GitHub
2. Your n8n workflow receives `deals.json` payload
3. Process and send via Kit

## Contributing

This is a private repository for Internet E-Business, LLC.

## License

MIT License - Internet E-Business, LLC

---

Built with ❤️ for [eTravelogs.com](https://etravelogs.com) | [Miles Calculator](https://etravelogs.com/miles-points-vs-cash-calculator/)
