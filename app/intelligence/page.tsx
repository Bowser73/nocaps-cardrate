"use client";
import { useState } from 'react';
import Link from 'next/link';
import { analyzePokemon, type PokemonIdentity, type PokemonSale } from '@/lib/intelligence/pokemon';
const initial: PokemonIdentity = { name: '', set: '', number: '', variant: '', language: 'English', condition: 'Near mint', gradeCompany: '', grade: '' };
const labels: Record<keyof PokemonIdentity, string> = { name: 'Pokémon / card name', set: 'Exact set name', number: 'Collector number (e.g. 4/102)', variant: 'Variant (holo, reverse holo, 1st edition…)', language: 'Language', condition: 'Condition', gradeCompany: 'Grading company (blank for raw)', grade: 'Grade (blank for raw)' };
const money = (cents: number | null) => cents === null ? 'Not enough evidence' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export default function IntelligencePage() {
  const [identity, setIdentity] = useState(initial);
  const [sales, setSales] = useState<PokemonSale[]>([]);
  const [price, setPrice] = useState(''); const [url, setUrl] = useState(''); const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [observations, setObservations] = useState('');
  async function scan(form: FormData) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/intelligence/scan', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Scan failed');
      const next = { ...initial };
      for (const key of Object.keys(labels) as (keyof PokemonIdentity)[]) next[key] = data[key] || '';
      setIdentity(next); setObservations(`${data.observations} Review uncertain fields: ${data.uncertainFields.join(', ') || 'none flagged'}. Confirm every field before pricing.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Scan failed'); }
    finally { setBusy(false); }
  }
  const analysis = analyzePokemon(identity, sales);
  function addSale() {
    const cents = Math.round(Number(price) * 100);
    if (!price.trim() || !Number.isSafeInteger(cents) || cents <= 0 || !date || !url) { setError('Enter a positive sold price, sale date and source URL.'); return; }
    setSales([...sales, { ...identity, priceCents: cents, soldAt: date, url, currency: 'USD', sold: true }]);
    setPrice(''); setUrl(''); setDate(''); setError('');
  }
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-slate-100">
    <Link href="/" className="text-cyan-300">← CardRate home</Link>
    <header><p className="text-cyan-300">NoCaps CardRate · Pokémon intelligence</p><h1 className="mt-2 text-3xl font-bold">Know the card. Check the evidence.</h1><p className="mt-3 text-slate-300">Confirm identity, compare completed sales and see a defensible valuation range.</p></header>
    <aside className="rounded-xl border border-amber-600 p-4">Automatic sold-market data is not connected in this workspace. Add completed sales you have checked. This analysis stays in this tab; refreshing clears it. Photo recognition requires a server-side OpenAI connection. Every detected detail needs your confirmation.</aside>
    <form action={scan} className="rounded-xl bg-slate-900 p-5"><h2 className="text-xl font-semibold">Identify from photos</h2><div className="my-3 grid gap-4 sm:grid-cols-2"><label>Front image<input name="front" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-2 block w-full" /></label><label>Back image (optional)<input name="back" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full" /></label></div><button disabled={busy} className="rounded bg-cyan-700 px-5 py-3 disabled:opacity-50">{busy ? 'Identifying…' : 'Identify Pokémon card'}</button>{observations && <p className="mt-3 text-amber-300">{observations}</p>}{error && <p role="alert" className="mt-2 text-amber-300">{error}</p>}</form>
    <section className="rounded-xl bg-slate-900 p-5"><h2 className="text-xl font-semibold">1. Confirm the exact card</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{(Object.keys(labels) as (keyof PokemonIdentity)[]).map(key => <label key={key} className="text-sm">{labels[key]}<input className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-3" value={identity[key]} onChange={e => setIdentity({ ...identity, [key]: e.target.value })} /></label>)}</div><p className="mt-4 text-sm text-slate-400">Collector numbers are not serial numbers. Copyright year alone does not identify a Pokémon printing. Record edition, foil and other distinguishing marks in the variant.</p></section>
    <section className="rounded-xl bg-slate-900 p-5"><h2 className="text-xl font-semibold">2. Check completed sales</h2><a className="my-3 inline-block text-cyan-300 underline" href={analysis.soldSearchUrl} target="_blank" rel="noopener noreferrer">Search eBay sold listings ↗</a><p className="text-sm text-slate-300">Add only an individual completed sale matching every field above. Check the actual accepted price; exclude lots, proxies, reprints and asking prices.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><label>Sold price (USD)<input type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full rounded bg-slate-950 p-3" /></label><label>Sale date<input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded bg-slate-950 p-3" /></label><label>Sale source URL<input type="url" value={url} onChange={e => setUrl(e.target.value)} className="w-full rounded bg-slate-950 p-3" /></label></div><button onClick={addSale} className="mt-4 rounded bg-cyan-700 px-5 py-3">Add matching sale</button>{error && <p role="alert" className="mt-2 text-amber-300">{error}</p>}</section>
    <section className="rounded-xl border border-cyan-800 bg-slate-900 p-5" aria-live="polite"><h2 className="text-xl font-semibold">3. Evidence report</h2><p className="mt-2">{analysis.status.replaceAll('_', ' ')} · {analysis.count} matching sales · Evidence quality: {analysis.confidence.toLowerCase()}</p>{analysis.missing.length > 0 && <p className="text-amber-300">Confirm: {analysis.missing.join(', ')}</p>}<p className="my-4 text-3xl font-bold">{money(analysis.medianCents)}</p><p>Observed range: {money(analysis.lowCents)} – {money(analysis.highCents)}</p><p className="mt-2 text-sm">At least three exact matches are required. The center estimate uses the median to reduce the impact of extreme prices.</p><ul className="mt-4 space-y-2 text-sm text-slate-300">{analysis.warnings.map(w => <li key={w}>{w}</li>)}</ul></section>
    <section><h2 className="text-xl font-semibold">Sale evidence</h2>{sales.map((sale, i) => <div key={i} className="mt-2 rounded bg-slate-900 p-3"><p>{money(sale.priceCents)} · {sale.soldAt} · {sale.name} · {sale.variant}</p><p className="break-all text-sm">{sale.url}</p><p className="text-amber-300">{analysis.rejected.find(r => r.url === sale.url)?.reason ?? 'Matching user-supplied sale'}</p><button className="mt-2 text-cyan-300" onClick={() => setSales(sales.filter((_, index) => index !== i))}>Remove sale</button></div>)}</section>
  </main>;
}
