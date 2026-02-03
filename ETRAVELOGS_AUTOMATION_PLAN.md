# eTravelogs Automation Plan

**Last Updated:** February 3, 2026
**Status:** ⚠️ PAUSED - Critical issues identified

---

## Executive Summary

The automated deal scraping and WordPress publishing system has been **disabled** due to critical data quality issues. The scrapers are producing inaccurate prices ($1 flights) and broken affiliate links, which would mislead users and damage site credibility.

---

## Current System Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ GitHub Actions  │────▶│ Playwright       │────▶│ Google Flights/ │
│ (Daily Cron)    │     │ Scrapers         │     │ Hotels          │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │ DISABLED              │ BROKEN
        ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ WordPress       │◀────│ JSON Output      │
│ REST API        │     │ (deals.json)     │
└─────────────────┘     └──────────────────┘
```

---

## Critical Issues (February 2026)

### Issue #1: $1 Flight Prices
| Aspect | Details |
|--------|---------|
| **Symptom** | All flights showing $1 price |
| **Root Cause** | Price extraction selectors broken; fallback value used |
| **Impact** | Completely inaccurate data, misleading users |
| **Status** | ❌ Not Fixed |

### Issue #2: Double-Encoded Expedia URLs
| Aspect | Details |
|--------|---------|
| **Symptom** | Links show "Sorry, we've taken a wrong turn" |
| **Root Cause** | `URLSearchParams` encoding special chars that Expedia expects raw |
| **Example** | `%253A` instead of `:` |
| **Fix Attempted** | Manual URL construction without URLSearchParams |
| **Status** | 🔄 Fix committed but not tested |

### Issue #3: Hotel Price Mismatch
| Aspect | Details |
|--------|---------|
| **Symptom** | Scraped: $104/night, Actual Expedia: $262+/night |
| **Root Cause** | Scraper getting wrong element or cached/stale data |
| **Impact** | Misrepresentation of deals |
| **Status** | ❌ Not Fixed |

### Issue #4: Generic Hotel Links
| Aspect | Details |
|--------|---------|
| **Symptom** | Links go to city search, not specific hotel |
| **Root Cause** | Can't generate direct hotel deep links without hotel ID |
| **Impact** | Poor user experience |
| **Status** | ❌ Not Fixed |

---

## Bookmarklet Issues

The manual capture bookmarklets are also broken:

### Flight Deal Bookmarklet
```javascript
javascript:(function () {
  const dealText =
    document.querySelector('a[data-test="link-view-flight"]')?.textContent ||
    Array.from(document.querySelectorAll('a'))
      .find(a => a.textContent.includes('flight on'))?.textContent ||
    'No deal found';
  const url = window.location.href;
  const encodedDeal = encodeURIComponent(dealText);
  const encodedUrl  = encodeURIComponent(url);
  fetch(
    `https://n8n.internete.biz/webhook/expedia-deal-capture?deal=${encodedDeal}&url=${encodedUrl}`
  )
    .then(() => alert('✅ Sent to n8n'))
    .catch(err => alert('❌ Failed to send: ' + err.message));
})();
```

**Issues:**
- `data-test="link-view-flight"` selector may be outdated (Expedia changes DOM frequently)
- Need to verify n8n webhook is still active
- URL encoding in bookmarklet itself is corrupted (shows `%27` instead of quotes)

### Hotel Deal Bookmarklet
```javascript
javascript:(function(){
  try {
    const u = 'https://script.google.com/macros/s/AKfycbz7vW3LvGwQ0gmf1JpsZKrTJPzKvO9NzPBpj0CzKRrwekzWoY7j2ptSYWtq4txRmd6rtA/exec';
    const t = new Date().toISOString();
    const c = document.querySelectorAll(
      '[data-stid="property-card-wrap"],' +
      '[data-testid="property-card-container"],' +
      '[data-stid*="property-card"],' +
      '[data-stid*="lodging-card"],' +
      'article.uitk-card'
    );
    // ... rest of script
  } catch(e) {
    alert("❌ Script Error: " + e.message);
  }
})();
```

**Issues:**
- Selectors like `[data-stid="property-card-wrap"]` may be outdated
- Google Apps Script URL may have changed or expired
- Price regex `/$\d[\d,]/g` has syntax error (should be `/\$\d[\d,]*/g`)
- URL-encoded quotes (`%27`) breaking the script

### Bookmarklet Fix Needed
1. Update selectors by inspecting current Expedia DOM
2. Fix URL encoding (use proper escaping)
3. Verify webhook/Apps Script endpoints are active
4. Test on current Expedia pages

---

## What's Currently Disabled

| Component | Status | Reason |
|-----------|--------|--------|
| Daily cron schedule | ❌ Disabled | Would publish bad data |
| WordPress auto-publish | ❌ Disabled | Data quality issues |
| Manual workflow runs | ✅ Works | For debugging only |
| Artifact uploads | ✅ Works | For inspection |
| Bookmarklets | ⚠️ Broken | Selectors outdated |

---

## Recommended Path Forward

### Option A: Fix Scrapers (High Effort, Uncertain Success)
- Update all CSS selectors for Google Flights/Hotels
- Add robust error handling and validation
- Implement price sanity checks (reject $1 prices)
- Test extensively before re-enabling

**Risk:** Google frequently changes their DOM, requiring constant maintenance.

### Option B: Use Official APIs (Medium Effort, More Reliable)
- **Amadeus API** - Flight/hotel search (requires approval)
- **Skyscanner API** - Flight prices (requires partnership)
- **Expedia Affiliate API** - Direct affiliate integration

**Benefit:** Stable data, proper pricing, official support.

### Option C: RSS/Feed Aggregation (Low Effort)
- Pull deals from The Points Guy, Secret Flying, etc.
- Curate and republish with attribution
- No scraping required

**Benefit:** Someone else maintains deal accuracy.

### Option D: Manual Curation (Current Fallback)
- Continue posting deals manually
- Use post-generator for formatting only
- Verify all prices before publishing

**Benefit:** 100% accuracy, full control.

---

## Technical Debt

1. **No price validation** - Scraper accepts any value including $1
2. **Brittle selectors** - Hard-coded CSS selectors break when sites update
3. **No retry logic** - Single failure = no data
4. **No alerting** - Don't know when scraper breaks until checking manually
5. **URL encoding issues** - Multiple places construct URLs differently

---

## Files Modified (February 2026)

| File | Changes |
|------|---------|
| `.github/workflows/daily-scraper.yml` | Disabled schedule and WP publish |
| `README.md` | Added Known Issues section |
| `scrapers/flight-deals.js` | Day rotation, fixed URL encoding |
| `scrapers/hotel-deals.js` | Day rotation, fixed URL encoding |
| `scrapers/run-all.js` | Updated for day rotation |
| `wordpress/post-generator.js` | Simplified HTML format, added REST API |
| `package.json` | Added `publish:wp` script |

---

## Re-enablement Checklist

Before turning automation back on:

- [ ] Flight prices are accurate (verified against Expedia)
- [ ] Hotel prices match actual booking prices
- [ ] Expedia deep links work correctly
- [ ] Hotel links go to specific properties (not generic search)
- [ ] Price validation rejects obviously wrong values
- [ ] Bookmarklets working for manual capture
- [ ] Full end-to-end test completed
- [ ] Run 3 days manually and verify all links work

---

## Contacts & Resources

- **Expedia Affiliate Program:** https://affiliates.expedia.com
- **n8n Webhook:** `https://n8n.internete.biz/webhook/expedia-deal-capture`
- **Google Apps Script:** `https://script.google.com/macros/s/AKfycbz7vW3LvGwQ0gmf1JpsZKrTJPzKvO9NzPBpj0CzKRrwekzWoY7j2ptSYWtq4txRmd6rtA/exec`
- **WordPress Site:** https://etravelogs.com
- **GitHub Repo:** https://github.com/internetebiz/etravelogs_deals

---

## Appendix: Working Bookmarklet Templates

### Fixed Flight Bookmarklet (needs selector update)
```javascript
javascript:(function(){
  var dealText = document.body.innerText.match(/\$\d+.*?flight/i)?.[0] || 'No deal found';
  var url = window.location.href;
  fetch('https://n8n.internete.biz/webhook/expedia-deal-capture?deal=' +
    encodeURIComponent(dealText) + '&url=' + encodeURIComponent(url))
    .then(function(){ alert('Sent to n8n'); })
    .catch(function(err){ alert('Failed: ' + err.message); });
})();
```

### Fixed Hotel Bookmarklet (needs selector update)
```javascript
javascript:(function(){
  var cards = document.querySelectorAll('[data-stid*="card"], article');
  var deals = [];
  cards.forEach(function(c){
    var title = c.querySelector('h2,h3')?.innerText || '';
    var price = c.innerText.match(/\$\d[\d,]*/)?.[0] || '';
    if(title && price) deals.push({title:title, price:price});
  });
  if(deals.length === 0){ alert('No deals found'); return; }
  fetch('https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec', {
    method: 'POST',
    body: JSON.stringify({deals: deals, url: location.href})
  }).then(function(){ alert('Sent ' + deals.length + ' deals'); });
})();
```

---

*Document created: February 3, 2026*
*For Claude Code Cowork mode collaboration*
