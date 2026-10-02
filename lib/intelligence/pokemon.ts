export type PokemonIdentity = {
  name: string; set: string; number: string; variant: string; language: string;
  condition: string; gradeCompany: string; grade: string;
};
export type PokemonSale = PokemonIdentity & {
  url: string; soldAt: string; priceCents: number; currency: string; sold: boolean;
};
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9/]+/g, ' ').trim();
const identityFields = ['name', 'set', 'number', 'variant', 'language', 'condition', 'gradeCompany', 'grade'] as const;
export function analyzePokemon(identity: PokemonIdentity, sales: PokemonSale[], now = Date.now()) {
  const missing = ['name', 'set', 'number', 'variant', 'language', 'condition'].filter(key => !normalize(identity[key as keyof PokemonIdentity]) || /needs review|unknown/.test(normalize(identity[key as keyof PokemonIdentity])));
  if (Boolean(identity.gradeCompany.trim()) !== Boolean(identity.grade.trim())) missing.push('gradeCompany / grade');
  const rejected: { url: string; reason: string }[] = [];
  const accepted: PokemonSale[] = [];
  const seen = new Set<string>();
  for (const sale of sales) {
    let reason = '';
    let url: URL | undefined;
    try { url = new URL(sale.url); } catch { /* reported below */ }
    const age = (now - Date.parse(sale.soldAt)) / 86400000;
    if (missing.length) reason = 'Confirm the complete card identity first';
    else if (!sale.sold) reason = 'Asking prices are not completed sales';
    else if (sale.currency !== 'USD') reason = 'Only USD sales can be compared';
    else if (!Number.isSafeInteger(sale.priceCents) || sale.priceCents <= 0) reason = 'Invalid sale price';
    else if (!url || url.protocol !== 'https:' || url.username || url.password) reason = 'A valid HTTPS sale source is required';
    else if (!Number.isFinite(age) || age < 0 || age > 180) reason = 'Sale must be dated within the last 180 days';
    else {
      const mismatch = identityFields.find(key => normalize(identity[key]) !== normalize(sale[key]));
      if (mismatch) reason = `Different ${mismatch}`;
    }
    const canonical = url ? url.origin + url.pathname.replace(/\/$/, '') : sale.url;
    if (!reason && seen.has(canonical)) reason = 'Duplicate sale source';
    if (reason) rejected.push({ url: sale.url, reason });
    else { seen.add(canonical); accepted.push(sale); }
  }
  const prices = accepted.map(sale => sale.priceCents).sort((a, b) => a - b);
  const median = prices.length ? Math.round((prices[Math.floor((prices.length - 1) / 2)] + prices[Math.floor(prices.length / 2)]) / 2) : null;
  const spread = median ? (prices[prices.length - 1] - prices[0]) / median : 0;
  // Evidence quality is descriptive, not a calibrated probability of accuracy.
  const confidence = prices.length >= 8 && spread <= 0.5 ? 'HIGH' : prices.length >= 3 && spread <= 1 ? 'MEDIUM' : 'LOW';
  const query = [identity.name, identity.set, identity.number, identity.variant, identity.language, identity.gradeCompany, identity.grade].filter(Boolean).join(' ');
  return {
    status: missing.length ? 'NEEDS_REVIEW' : prices.length < 3 ? 'INSUFFICIENT_EVIDENCE' : 'ESTIMATE',
    missing, accepted, rejected, count: prices.length,
    medianCents: prices.length >= 3 ? median : null,
    lowCents: prices.length >= 3 ? prices[0] : null,
    highCents: prices.length >= 3 ? prices[prices.length - 1] : null,
    confidence, query,
    soldSearchUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`,
    warnings: [
      'Sales are user supplied and have not been independently verified.',
      ...(spread > 1 ? ['Wide price spread: inspect sale evidence before relying on the estimate.'] : []),
      'Raw and graded cards, grading companies, grades, languages, variants and conditions are never blended.',
      'No grade, authenticity guarantee or future return can be inferred from a photograph.'
    ]
  };
}
