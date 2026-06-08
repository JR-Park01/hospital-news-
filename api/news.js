export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query 파라미터 필요' });

  const NAVER_ID     = process.env.NAVER_CLIENT_ID;
  const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;

  const results = { naver: [], google: [] };

  // ── 네이버 뉴스 API ──────────────────────────────
  // 검색어가 길면 짧게 핵심만 추출
  const naverQuery = query.replace(/"/g, '').split(' OR ')[0].split(' ').slice(0,3).join(' ');

  try {
    const naverUrl = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(naverQuery)}&display=5&sort=date`;
    const naverRes = await fetch(naverUrl, {
      headers: {
        'X-Naver-Client-Id': NAVER_ID,
        'X-Naver-Client-Secret': NAVER_SECRET,
      },
    });
    const naverData = await naverRes.json();
    results.naver = (naverData.items || []).map(i => ({
      title:  i.title.replace(/<[^>]+>/g, ''),
      url:    i.link,
      source: (() => { try { return new URL(i.originallink).hostname.replace('www.',''); } catch { return '네이버뉴스'; } })(),
      time:   new Date(i.pubDate).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
      from:   'n',
    }));
  } catch (e) {
    results.naverError = e.message;
  }

  // ── Google 뉴스 RSS ──────────────────────────────
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
    const rssRes = await fetch(rssUrl);
    const rssText = await rssRes.text();

    const items = [...rssText.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
    results.google = items.map(m => {
      const block = m[1];
      const getTag = tag => { const r = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)); return r ? r[1].replace(/<!\[CDATA\[|\]\]>/g,'').trim() : ''; };
      const rawTitle = getTag('title');
      const match = rawTitle.match(/^(.*)\s-\s([^-]+)$/);
      const title  = match ? match[1].trim() : rawTitle;
      const source = match ? match[2].trim() : 'Google뉴스';
      const pubDate = getTag('pubDate');
      const time = pubDate ? new Date(pubDate).toLocaleDateString('ko-KR', { month:'numeric', day:'numeric' }) : '';
      const link = getTag('link') || block.match(/<link\s*\/>([^\s<]+)/)?.[1] || '#';
      return { title, source, time, url: link, from: 'g' };
    });
  } catch (e) {
    results.googleError = e.message;
  }

  return res.status(200).json(results);
}
