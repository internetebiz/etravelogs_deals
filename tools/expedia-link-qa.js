/**
 * Expedia affiliate QA — verifies the ACTUAL click path that real users follow
 * on daily-deals posts, and asserts Partnerize attribution end to end.
 *
 * As of 2026-07-10 posts carry DIRECT affiliate links (YOURLS retired):
 *   - prf.hn Partnerize click redirects (hotels/activities)
 *   - expedia.com/affiliates/... links (flights; Expedia's own affiliate short links)
 *   - legacy go.etravelogs.com shortlinks in OLD posts (still wrapped server-side)
 *
 * FAILS when:
 *   - a post has zero booking links, or any dead href="#" button
 *   - a booking link resolves without Partnerize attribution (no prf.hn/camref/partnernetwork)
 *   - a prf.hn destination is GENERIC (bare expedia.com, /deals, or Hotel-Search
 *     with no ?destination=) — the July 8-10 capture-fallback failure mode
 *   - >50% of a post's booking buttons share one identical URL (capture collapse)
 *   - >50% of a hotel post's buttons are name-SEARCH fallbacks (Hotel-Search?destination=
 *     <hotel name>) instead of real .hNNNNN.Hotel-Information property pages. These are
 *     tracked and non-generic, so every other check passes them — which is exactly how
 *     the capture ran dead from Jul 11-30 2026 without a single alert. A name search is
 *     a degraded landing page, not a booking page.
 *
 * Auth-free (public WP REST + public redirects). Exit 1 on failure so cron can alert.
 *
 * Usage: node tools/expedia-link-qa.js [--days=3] [--sample=6]
 */
const SITE = 'https://etravelogs.com';
const ARGS = process.argv.slice(2);
const DAYS = parseInt((ARGS.find(a => a.startsWith('--days=')) || '').split('=')[1] || '3', 10);
const SAMPLE = parseInt((ARGS.find(a => a.startsWith('--sample=')) || '').split('=')[1] || '6', 10);

function isTracked(chainUrls) {
  return chainUrls.some(u => /prf\.hn\//i.test(u) || /[?&/]camref[:=]/i.test(u) || /\/partnernetwork\//i.test(u) || /expedia\.com\/affiliates\//i.test(u));
}
function looksExpedia(u) { return /expedia\.com/i.test(u); }

// prf.hn destination that lands users nowhere useful
function genericDestination(url) {
  const encoded = (url.split('/destination:')[1] || '');
  if (!encoded) return false;
  let d; try { d = decodeURIComponent(encoded); } catch (e) { d = encoded; }
  let bare = d.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  return bare === 'expedia.com' || bare === 'expedia.com/deals' || bare === 'expedia.com/hotel-search';
}

// Decode the real Expedia URL a button ultimately points at (unwrapping prf.hn).
function destinationOf(url) {
  const encoded = (url.split('/destination:')[1] || '');
  if (!encoded) return url;
  try { return decodeURIComponent(encoded); } catch (e) { return encoded; }
}

// What kind of page does this button land on?
//   property  — a real bookable page. Since Expedia's ~Jul 11 2026 deals-page redesign that
//               is Hotel-Search?...selected=<propertyId> (property + deal dates); the older
//               .hNNNNN.Hotel-Information shape and activity pages still count.
//   search    — the n8n normalizeAffLink() fallback: Hotel-Search?destination=<hotel name>
//   shortlink — Expedia's own affiliate short links (the static flight buttons)
function linkKind(url) {
  const d = destinationOf(url);
  if (/\.h\d+\.Hotel-Information/i.test(d) || /things-to-do\/a\.a\d+/i.test(d)) return 'property';
  if (/Hotel-Search\?[^\s]*selected=\d+/i.test(d)) return 'property';
  if (/expedia\.com\/affiliates\//i.test(d)) return 'shortlink';
  if (/Hotel-Search\?destination=/i.test(d)) return 'search';
  return 'other';
}

// Follow up to `max` redirect hops, return the list of URLs visited (incl. start).
async function chase(url, max = 6) {
  const chain = [url];
  let cur = url;
  for (let i = 0; i < max; i++) {
    let res;
    try {
      res = await fetch(cur, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (etravelogs-affiliate-qa)' } });
    } catch (e) { chain.push('ERROR:' + e.message); break; }
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      cur = loc.startsWith('http') ? loc : new URL(loc, cur).href;
      chain.push(cur);
    } else break;
  }
  return chain;
}

async function latestDealsPosts() {
  const r = await fetch(`${SITE}/wp-json/wp/v2/posts?per_page=40&orderby=date&order=desc&_fields=id,date,link,title,content`);
  if (!r.ok) throw new Error(`WP REST ${r.status}`);
  const posts = await r.json();
  const cutoff = Date.now() - DAYS * 864e5;
  const isDeals = p => /daily-(hotel|flight)-deals/i.test(p.link || '') || /Best (Hotel|Flight) Deals/i.test((p.title && p.title.rendered) || '');
  return posts
    .filter(p => isDeals(p))
    .filter(p => { const t = Date.parse(p.date + 'Z'); return isNaN(t) ? true : t >= cutoff; });
}

(async () => {
  console.log(`\nExpedia affiliate QA — last ${DAYS} day(s) of daily-deals posts, sampling ${SAMPLE} links each\n`);
  const posts = await latestDealsPosts();
  if (!posts.length) { console.log('No recent daily-deals posts found.'); process.exit(1); }

  let anyFail = false;
  const summary = [];
  const dateCounts = {}; // duplicate-post detection: slug date -> count per type

  for (const p of posts) {
    const html = (p.content && p.content.rendered) || '';
    const title = ((p.title && p.title.rendered) || '').replace(/<[^>]+>/g, '').slice(0, 40);
    const problems = [];

    const dkey = ((p.link || '').match(/daily-(hotel|flight)-deals-(\d{4}-\d{2}-\d{2})/) || [])[0];
    if (dkey) { dateCounts[dkey] = (dateCounts[dkey] || 0) + 1; if (dateCounts[dkey] > 1) problems.push('DUPLICATE post for ' + dkey); }

    // anchor hrefs only (buttons users click); ignore schema/script URLs
    const hrefs = [...html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)].map(m => m[1].replace(/&amp;/g, '&'));
    const dead = hrefs.filter(h => h === '#' || h === '').length;
    if (dead) problems.push(`${dead} dead href="#" buttons`);

    const booking = hrefs.filter(h => /go\.etravelogs\.com\/|prf\.hn\/|expedia\.com/i.test(h));
    if (!booking.length) {
      anyFail = true;
      summary.push(`  ✗ FAIL  [${p.id}] "${title}"  — NO booking links at all${dead ? ` (+${dead} dead buttons)` : ''}`);
      continue;
    }

    // capture-collapse: most buttons identical (only meaningful on multi-deal posts)
    const freq = {};
    booking.forEach(h => { freq[h] = (freq[h] || 0) + 1; });
    const [topUrl, topN] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    if (booking.length > 5 && topN / booking.length > 0.5) {
      problems.push(`${topN}/${booking.length} buttons share ONE url (capture collapse): ${topUrl.slice(0, 80)}`);
    }

    // generic prf.hn destinations
    const generic = booking.filter(h => /prf\.hn\//i.test(h) && genericDestination(h));
    if (generic.length) problems.push(`${generic.length} buttons -> GENERIC destination (blank search page)`);

    // capture dead: buttons degraded to name-search fallbacks instead of property pages.
    // Only meaningful on hotel posts — flight posts are supposed to be affiliate shortlinks.
    const isHotelPost = /daily-hotel-deals/i.test(p.link || '');
    const kinds = booking.map(linkKind);
    const searchN = kinds.filter(k => k === 'search').length;
    const propertyN = kinds.filter(k => k === 'property').length;
    if (isHotelPost && booking.length > 5) {
      if (searchN / booking.length > 0.5) {
        problems.push(
          `CAPTURE DEAD: ${searchN}/${booking.length} buttons are name-SEARCH fallbacks ` +
          `(only ${propertyN} real property pages) — Cowork is not extracting hotel URLs`
        );
      }
    }

    // raw untracked expedia links in buttons
    const rawExpedia = booking.filter(h => looksExpedia(h) && !isTracked([h]) && !/go\.etravelogs\.com/i.test(h));
    if (rawExpedia.length) problems.push(`${rawExpedia.length} raw untracked expedia buttons, e.g. ${rawExpedia[0].slice(0, 80)}`);

    // sample links and resolve the real click path
    const uniq = [...new Set(booking)];
    let tracked = 0, untracked = 0;
    const bad = [];
    for (const s of uniq.slice(0, SAMPLE)) {
      const chain = await chase(s);
      const final = chain[chain.length - 1];
      if (isTracked(chain)) tracked++;
      else { untracked++; bad.push((looksExpedia(final) ? '' : '(non-expedia) ') + final.slice(0, 90)); }
    }
    if (untracked) problems.push(`${untracked} sampled links resolve UNTRACKED, e.g. ${bad[0]}`);

    const ok = problems.length === 0;
    if (!ok) anyFail = true;
    summary.push(
      `  ${ok ? '✓ PASS' : '✗ FAIL'}  [${p.id}] "${title}"  — ${tracked}/${Math.min(uniq.length, SAMPLE)} sampled tracked, ` +
      `${booking.length} buttons (${propertyN} property / ${searchN} search)` +
      (problems.length ? '\n           ' + problems.join('\n           ') : '')
    );
  }

  console.log(summary.join('\n'));
  console.log(`\n================ QA ${anyFail ? 'FAIL' : 'PASS'} ================`);
  console.log(`Posts checked: ${posts.length}`);
  console.log(anyFail
    ? 'At least one daily-deals post has broken, generic, or untracked booking links.\nReal user clicks are NOT reaching the right page with attribution.'
    : 'All sampled booking links route through Partnerize with real destinations. Tracking is live.');
  process.exit(anyFail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(2); });
