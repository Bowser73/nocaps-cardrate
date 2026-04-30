"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  BookmarkPlus,
  Calculator,
  Camera,
  Check,
  ChevronRight,
  CircleAlert,
  Crown,
  Database,
  Download,
  ImagePlus,
  LineChart,
  ListChecks,
  Loader2,
  PlugZap,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Upload
} from "lucide-react";
import { Disclaimer } from "@/components/Disclaimer";
import { SportBadge } from "@/components/SportBadge";
import { formatMoney } from "@/lib/money";
import { providerSourceLabels } from "@/lib/providers/labels";
import { sportOptions } from "@/lib/sports";

const maxUploadBytes = 15 * 1024 * 1024;
const maxImageSide = 1800;
const reviewText = "Needs review";
const noRationaleText = "No grading rationale provided.";
const isLocalDevPro = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEV_PRO === "true";
const isDevelopmentMode = process.env.NODE_ENV !== "production";
const defaultMarketGalleryQueries = [
  "CJ Stroud rookie card",
  "football rookie card PSA",
  "basketball rookie card PSA",
  "baseball rookie card PSA",
  "Topps Chrome rookie card",
  "Panini Prizm rookie card"
];
const fallbackMarketGalleryQueries = [
  "CJ Stroud rookie card",
  "football rookie card PSA",
  "basketball rookie card PSA",
  "baseball rookie card PSA",
  "Topps Chrome rookie card",
  "Panini Prizm rookie card"
];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ScanResult = {
  sport: string;
  playerName: string;
  year: number | null;
  brand: string;
  setName: string;
  cardNumber: string;
  parallel: string;
  serialNumber: string;
  rookieFlag: boolean;
  autographFlag: boolean;
  relicFlag: boolean;
  team: string;
  conditionNotes: { centering: string; corners: string; edges: string; surface: string; overall: string };
  gradingHelper: { worthConsidering: boolean; rationale: string };
  confidenceScore: number;
  uncertainFields: string[];
};

type PriceEstimate = {
  status: "FOUND" | "NO_COMPS" | "NOT_CONNECTED";
  message?: string;
  lowEstimateCents: number | null;
  averageEstimateCents: number | null;
  highEstimateCents: number | null;
  confidenceScore: number;
  valueInsights: {
    estimatedRawValueCents: number | null;
    potentialGradedValueCents: number | null;
    gradingSpreadCents: number | null;
    worthGrading: "YES" | "MAYBE" | "NO" | "UNKNOWN";
    rationale: string;
  };
  comps: Array<{
    title: string;
    salePriceCents: number;
    soldAt: string | null;
    source: string;
    condition?: string | null;
    listingUrl?: string | null;
    isDemo?: boolean;
    saleType?: "RAW" | "GRADED" | "UNKNOWN";
    relevanceScore?: number;
    matchNotes?: string[];
  }>;
  debug?: {
    exactQuery: string;
    broaderQuery?: string;
    rawSoldCompsReturned: number;
    compsRemovedByFilters: number;
    usableComps: number;
    removedCompReasons: Array<{ title: string; reason: string }>;
    confidenceScore: number;
    confidenceExplanation: string;
    activeListingsUsedOnlyAsMarketSentiment: boolean;
  };
};

type CollectionItem = {
  id: string;
  estimatedValueCents: number | null;
  purchasePriceCents: number | null;
  status: string;
  card: {
    sport: string;
    playerName: string;
    year: number | null;
    brand: string | null;
    setName: string | null;
    parallel: string | null;
    team: string | null;
  };
};

type CollectionResponse = {
  items: CollectionItem[];
  summary: {
    totalCards: number;
    totalValueCents: number;
    sportTotals: Record<string, number>;
    highestValueCards: CollectionItem[];
    recentlyAddedCards: CollectionItem[];
  };
};

type TabKey = "dashboard" | "scan" | "collection" | "deals" | "flips" | "market";
type DealSort = "flipScore" | "roi" | "profit";

type DealFind = {
  player: string;
  sport: string;
  year: number | null;
  brandSet: string;
  cardNumber: string | null;
  currentAskingPriceCents: number;
  averageSoldPriceCents: number | null;
  estimatedUpsideCents: number | null;
  confidenceScore: number;
  marketplaceSource: string;
  listingUrl: string;
  listingTitle: string;
  dealLabel: "Strong Deal" | "Possible Deal" | "Needs Research" | "Avoid";
  flipScore: number;
  flipScoreLabel: "Strong Buy" | "Watch" | "Risky" | "Avoid";
  soldCompCount: number;
  activeListing?: {
    imageUrl?: string | null;
  };
};

type MarketGalleryListing = {
  id: string;
  title: string;
  imageUrl: string | null;
  listedPriceCents: number;
  shippingPriceCents: number | null;
  sport: "Football" | "Baseball" | "Basketball" | "Other";
  tags: string[];
  source: "eBay Active Listings" | "Demo/Test Data";
  listingUrl: string;
  listedAt: string | null;
  isDemo: boolean;
};

type ActiveAskingListing = Pick<MarketGalleryListing, "id" | "title" | "listedPriceCents" | "shippingPriceCents" | "source" | "listingUrl" | "imageUrl" | "isDemo">;

type DiagnosticsState = {
  lastMarketRequest: string;
  lastMarketResponseCount: number | null;
  lastMarketRawCount: number | null;
  lastMarketFilteredCount: number | null;
  lastMarketSampleTitles: string[];
  defaultFeedLoaded: boolean;
  defaultFeedResultCount: number;
  lastDefaultQuery: string;
  lastMarketError: string;
  lastPricingQuery: string;
  rawSoldCompsReturned: number | null;
  usableSoldComps: number | null;
  lastPricingError: string;
  rateLimitHit: boolean;
};

type MarketFilter = "All" | "Football" | "Baseball" | "Basketball" | "Graded" | "Autos" | "Numbered";
type MarketSort = "Best Match" | "Highest Price" | "Lowest Price" | "Newly Listed" | "Premium First";
type SharedSportFilter = "all" | "football" | "baseball" | "basketball";

type FlipRecord = {
  id: string;
  player: string;
  cardSummary: string;
  status: "Watching" | "Bought" | "Sent to Grade" | "Listed" | "Sold" | "Passed";
  purchaseDate: string;
  purchasePrice: number;
  source: string;
  listedPrice: number;
  soldPrice: number;
  saleDate: string;
  notes: string;
};

type AppStatus = {
  ebay: {
    status: "Pending" | "Not connected" | "Connected";
    hasClientId: boolean;
    hasClientSecret: boolean;
    message: string;
  };
  demo: {
    allowed: boolean;
    message: string;
  };
  sportsCardsPro?: {
    status: "Not connected" | "Connected";
    enabled: boolean;
    hasApiKey: boolean;
    message: string;
  };
};

type ManualComp = {
  id: string;
  salePrice: number;
  soldAt: string;
  source: string;
  saleType: "RAW" | "GRADED" | "UNKNOWN";
  notes: string;
};

type ManualActiveListing = {
  url: string;
  askingPrice: number;
};

const emptyResult: ScanResult = {
  sport: "BASEBALL",
  playerName: "",
  year: null,
  brand: "",
  setName: "",
  cardNumber: "",
  parallel: "",
  serialNumber: "",
  rookieFlag: false,
  autographFlag: false,
  relicFlag: false,
  team: "",
  conditionNotes: { centering: reviewText, corners: reviewText, edges: reviewText, surface: reviewText, overall: reviewText },
  gradingHelper: { worthConsidering: false, rationale: noRationaleText },
  confidenceScore: 0,
  uncertainFields: []
};

type PreparedImage = {
  file: File;
  previewUrl: string;
  originalSize: number;
};

export function CardRateApp() {
  const [frontImage, setFrontImage] = useState<PreparedImage | null>(null);
  const [backImage, setBackImage] = useState<PreparedImage | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [form, setForm] = useState<ScanResult>(emptyResult);
  const [price, setPrice] = useState<PriceEstimate | null>(null);
  const [broaderPrice, setBroaderPrice] = useState<PriceEstimate | null>(null);
  const [broaderMessage, setBroaderMessage] = useState("");
  const [selectedParallel, setSelectedParallel] = useState("");
  const [pricingContextMessage, setPricingContextMessage] = useState("");
  const [activeAsks, setActiveAsks] = useState<ActiveAskingListing[]>([]);
  const [activeAsksLoading, setActiveAsksLoading] = useState(false);
  const [collection, setCollection] = useState<CollectionResponse | null>(null);
  const [activeSportFilter, setActiveSportFilter] = useState<SharedSportFilter>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [status, setStatus] = useState("RAW");
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [dealSort, setDealSort] = useState<DealSort>("flipScore");
  const [dealFinds, setDealFinds] = useState<DealFind[]>([]);
  const [dealMessage, setDealMessage] = useState("Live deal finder not connected yet.");
  const [flips, setFlips] = useState<FlipRecord[]>([]);
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [demoMode] = useState(false);
  const [manualComps, setManualComps] = useState<ManualComp[]>([]);
  const [manualListing, setManualListing] = useState<ManualActiveListing>({ url: "", askingPrice: 0 });
  const isProUser = isLocalDevPro;
  const [marketListings, setMarketListings] = useState<MarketGalleryListing[]>([]);
  const [marketMessage, setMarketMessage] = useState("Loading live marketplace listings...");
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketHasLoaded, setMarketHasLoaded] = useState(false);
  const [marketSearch, setMarketSearch] = useState("");
  const [marketFeedLabel, setMarketFeedLabel] = useState("Default Market Feed");
  const [defaultMarketListings, setDefaultMarketListings] = useState<MarketGalleryListing[]>([]);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("All");
  const [marketSort, setMarketSort] = useState<MarketSort>("Best Match");
  const [marketDemoMode, setMarketDemoMode] = useState(false);
  const [marketRetryLockedUntil, setMarketRetryLockedUntil] = useState(0);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({
    lastMarketRequest: "",
    lastMarketResponseCount: null,
    lastMarketRawCount: null,
    lastMarketFilteredCount: null,
    lastMarketSampleTitles: [],
    defaultFeedLoaded: false,
    defaultFeedResultCount: 0,
    lastDefaultQuery: "",
    lastMarketError: "",
    lastPricingQuery: "",
    rawSoldCompsReturned: null,
    usableSoldComps: null,
    lastPricingError: "",
    rateLimitHit: false
  });
  const marketGalleryLoadedRef = useRef(false);
  const marketGalleryLoadingRef = useRef(false);
  const marketGalleryQueueRef = useRef(0);
  const marketGalleryCacheRef = useRef(new Map<string, MarketGalleryListing[]>());
  const pendingMarketSearchRef = useRef<{ search: string; demo: boolean; force: boolean } | null>(null);
  const activeAsksRequestRef = useRef(0);

  useEffect(() => {
    void loadCollection();
  }, [activeSportFilter, search]);

  useEffect(() => {
    void loadStatus();
  }, []);

  useEffect(() => {
    if ((activeTab === "dashboard" || activeTab === "market") && !marketGalleryLoadedRef.current && !marketGalleryLoadingRef.current) {
      marketGalleryLoadedRef.current = true;
      void loadMarketGallery("", marketDemoMode, true);
    }
  }, [activeTab, marketDemoMode]);

  useEffect(() => {
    const stored = window.localStorage.getItem("cardrate-flips");
    if (stored) setFlips(JSON.parse(stored) as FlipRecord[]);
    const storedComps = window.localStorage.getItem("cardrate-manual-comps");
    if (storedComps) setManualComps(JSON.parse(storedComps) as ManualComp[]);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("cardrate-flips", JSON.stringify(flips));
  }, [flips]);

  useEffect(() => {
    window.localStorage.setItem("cardrate-manual-comps", JSON.stringify(manualComps));
  }, [manualComps]);

  useEffect(() => {
    return () => {
      if (frontImage?.previewUrl) URL.revokeObjectURL(frontImage.previewUrl);
    };
  }, [frontImage?.previewUrl]);

  useEffect(() => {
    return () => {
      if (backImage?.previewUrl) URL.revokeObjectURL(backImage.previewUrl);
    };
  }, [backImage?.previewUrl]);

  const sportCount = useMemo(() => Object.keys(collection?.summary.sportTotals ?? {}).length, [collection]);
  const uncertain = useMemo(() => new Set(form.uncertainFields ?? []), [form.uncertainFields]);
  const manualEstimate = useMemo(() => calculateManualEstimate(manualComps), [manualComps]);
  const manualDeal = useMemo(() => calculateManualDeal(manualListing, manualEstimate, form), [manualListing, manualEstimate, form]);
  const dealSearchCards = useMemo(() => {
    const scanned = scan
      ? [{
          sport: form.sport,
          playerName: form.playerName,
          year: form.year,
          brand: form.brand,
          setName: form.setName,
          cardNumber: form.cardNumber,
          parallel: form.parallel,
          serialNumber: form.serialNumber,
          rookieFlag: form.rookieFlag
        }]
      : [];
    const saved = (collection?.items ?? []).slice(0, 4).map((item) => ({
      sport: item.card.sport,
      playerName: item.card.playerName,
      year: item.card.year,
      brand: item.card.brand,
      setName: item.card.setName,
      cardNumber: null,
      parallel: item.card.parallel,
      serialNumber: null,
      rookieFlag: false
    }));
    return [...scanned, ...saved];
  }, [collection?.items, form, scan]);

  async function loadCollection() {
    const params = new URLSearchParams();
    const apiSport = sharedSportFilterToApiSport(activeSportFilter);
    if (apiSport) params.set("sport", apiSport);
    if (search) params.set("search", search);
    const response = await fetch(`/api/collection?${params}`);
    setCollection(await response.json());
  }

  async function loadStatus() {
    const response = await fetch("/api/status");
    const data = await response.json();
    setAppStatus(data);
  }

  async function prepareImage(file: File): Promise<PreparedImage> {
    const compressed = await compressImage(file);
    if (compressed.size > maxUploadBytes) {
      throw new Error("Image is still too large after compression. Please crop it closer to the card or choose a smaller photo.");
    }
    return {
      file: compressed,
      previewUrl: URL.createObjectURL(compressed),
      originalSize: file.size
    };
  }

  async function handleImage(side: "front" | "back", file?: File | null) {
    if (!file) return;
    setMessage(null);
    try {
      const prepared = await prepareImage(file);
      if (side === "front") setFrontImage(prepared);
      else setBackImage(prepared);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare this image.");
    }
  }

  async function scanCard() {
    if (!frontImage) {
      setMessage("Add the front of the card first. Add the back too for better accuracy.");
      return;
    }

    setBusy("scan");
    setMessage(null);
    setPrice(null);
    setBroaderPrice(null);
    setBroaderMessage("");
    setSelectedParallel("");
    setPricingContextMessage("");
    activeAsksRequestRef.current += 1;
    setActiveAsks([]);

    try {
      const body = new FormData();
      body.append("frontImage", frontImage.file);
      body.append("image", frontImage.file);
      if (backImage) body.append("backImage", backImage.file);

      const response = await fetch("/api/scan", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Scan failed.");
        return;
      }

      const result = normalizeClientScan(data.result);
      setScan(result);
      setForm(result);
      await priceCard(result);
    } catch {
      setMessage("Scan failed. Please try again with a clearer image.");
    } finally {
      setBusy(null);
    }
  }

  async function priceCard(card = form) {
    if (!card.playerName || card.playerName === reviewText) return;
    setBusy("price");
    setBroaderPrice(null);
    setBroaderMessage("");
    if (!selectedParallel) setPricingContextMessage("");
    setDiagnostics((current) => ({ ...current, lastPricingError: "" }));
    try {
      const [pricingResult] = await Promise.all([
        fetchPriceEstimate(card),
        loadActiveAsks(card)
      ]);
      setPrice(pricingResult);
      updatePricingDiagnostics(pricingResult);
      if (pricingResult.status !== "FOUND" || pricingResult.comps.length === 0) {
        const broadCard: Partial<ScanResult> = {
          ...card,
          setName: "",
          cardNumber: "",
          parallel: "rookie card",
          serialNumber: ""
        };
        const fallback = await fetchPriceEstimate(broadCard);
        updatePricingDiagnostics(fallback);
        const broader = fallback.status === "FOUND"
          ? { ...fallback, message: "Broader Matches" }
          : buildClientPriceEstimate([], "No broader sold comps found.");
        if (broader.debug && fallback.debug?.exactQuery) broader.debug.broaderQuery = fallback.debug.exactQuery;
        setBroaderPrice(broader);
        setBroaderMessage(broader.status === "FOUND" ? "Broader Matches" : "No broader sold comps found.");
      }
    } catch {
      setDiagnostics((current) => ({ ...current, lastPricingError: "Pricing request failed or returned no usable data." }));
      setPrice({
        status: "NO_COMPS",
        message: "No reliable sold comps found for this exact match. Try broadening the search.",
        lowEstimateCents: null,
        averageEstimateCents: null,
        highEstimateCents: null,
        confidenceScore: 0,
        comps: [],
        valueInsights: emptyValueInsights("No reliable sold comps found for this exact match. Try broadening the search.")
      });
    } finally {
      setBusy((current) => (current === "price" ? null : current));
    }
  }

  function updatePricingDiagnostics(result: PriceEstimate) {
    setDiagnostics((current) => ({
      ...current,
      lastPricingQuery: result.debug?.exactQuery || current.lastPricingQuery,
      rawSoldCompsReturned: result.debug?.rawSoldCompsReturned ?? current.rawSoldCompsReturned,
      usableSoldComps: result.debug?.usableComps ?? result.comps.length,
      lastPricingError: result.status === "FOUND" ? "" : result.message ?? "No usable sold comps returned."
    }));
  }

  async function fetchPriceEstimate(card: ScanResult | Partial<ScanResult>): Promise<PriceEstimate> {
    const response = await fetch("/api/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport: card.sport ?? form.sport,
        playerName: card.playerName ?? form.playerName,
        year: card.year ?? null,
        brand: card.brand ?? "",
        setName: card.setName ?? "",
        cardNumber: card.cardNumber ?? "",
        parallel: card.parallel ?? "",
        serialNumber: card.serialNumber ?? "",
        rookieFlag: card.rookieFlag ?? false,
        team: card.team ?? "",
        demoMode
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Pricing failed.");
    return data as PriceEstimate;
  }

  async function loadActiveAsks(card: ScanResult | Partial<ScanResult>) {
    if (!card.playerName || card.playerName === reviewText) return;
    const requestId = activeAsksRequestRef.current + 1;
    activeAsksRequestRef.current = requestId;
    setActiveAsks([]);
    setActiveAsksLoading(true);
    try {
      const query = buildActiveAskQuery(card);
      const params = new URLSearchParams({ q: query });
      const response = await fetch(`/api/market/gallery?${params}`);
      const data = await response.json();
      if (requestId !== activeAsksRequestRef.current) return;
      setActiveAsks(((data.listings ?? []) as MarketGalleryListing[]).slice(0, 5));
    } catch {
      if (requestId === activeAsksRequestRef.current) setActiveAsks([]);
    } finally {
      if (requestId === activeAsksRequestRef.current) setActiveAsksLoading(false);
    }
  }

  async function searchBroaderComps() {
    if (!form.playerName || form.playerName === reviewText) return;
    setBusy("broad-price");
    setBroaderMessage("");
    try {
      const broadCards: Partial<ScanResult>[] = [
        { ...form, cardNumber: "", parallel: "", serialNumber: "" },
        { ...form, setName: "", cardNumber: "", parallel: "", serialNumber: "" },
        { ...form, year: null, brand: "", setName: "", cardNumber: "", parallel: form.rookieFlag ? "rookie card" : "", serialNumber: "" },
        { ...form, year: null, brand: "", setName: "", parallel: "", serialNumber: "" }
      ];
      const estimates = await Promise.allSettled(broadCards.map((card) => fetchPriceEstimate(card)));
      const comps = estimates.flatMap((result) => result.status === "fulfilled" ? result.value.comps : []);
      const merged = buildClientPriceEstimate(comps, "Broader Matches");
      const broaderQueries = estimates
        .flatMap((result) => result.status === "fulfilled" && result.value.debug?.exactQuery ? [result.value.debug.exactQuery] : []);
      if (merged.debug) merged.debug.broaderQuery = broaderQueries.join(" | ");
      setBroaderPrice(merged);
      setBroaderMessage(merged.status === "FOUND" ? "Broader Matches" : "No broader sold comps found.");
    } catch {
      setBroaderPrice(buildClientPriceEstimate([], "No broader sold comps found."));
      setBroaderMessage("No broader sold comps found.");
    } finally {
      setBusy((current) => (current === "broad-price" ? null : current));
    }
  }

  async function searchParallelComps(parallel: string) {
    const nextCard = buildParallelSearchCard(form, parallel);
    setSelectedParallel(parallel);
    setPricingContextMessage(`Searching comps for ${parallel}...`);
    setForm(nextCard);
    setBusy("price");
    setBroaderPrice(null);
    setBroaderMessage("");
    setDiagnostics((current) => ({ ...current, lastPricingError: "" }));
    try {
      const [pricingResult] = await Promise.all([
        fetchPriceEstimate(nextCard),
        loadActiveAsks(nextCard)
      ]);
      const result = pricingResult.status === "FOUND"
        ? { ...pricingResult, message: `Parallel comp search: ${parallel}` }
        : {
            ...pricingResult,
            message: `No sold comps found for ${parallel}. Try broader comps.`,
            valueInsights: emptyValueInsights(`No sold comps found for ${parallel}. Try broader comps.`)
          };
      setPrice(result);
      setPricingContextMessage(result.status === "FOUND" ? `Parallel comp search: ${parallel}` : `No sold comps found for ${parallel}. Try broader comps.`);
      updatePricingDiagnostics(result);
    } catch (error) {
      console.warn("Parallel comp search warning", error);
      const message = `No sold comps found for ${parallel}. Try broader comps.`;
      setPrice({
        status: "NO_COMPS",
        message,
        lowEstimateCents: null,
        averageEstimateCents: null,
        highEstimateCents: null,
        confidenceScore: 0,
        comps: [],
        valueInsights: emptyValueInsights(message)
      });
      setPricingContextMessage(message);
      setDiagnostics((current) => ({ ...current, lastPricingError: message }));
    } finally {
      setBusy((current) => (current === "price" ? null : current));
    }
  }

  async function saveCard() {
    setBusy("save");
    try {
      const response = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          purchasePriceCents: purchasePrice ? Math.round(Number(purchasePrice) * 100) : null,
          estimatedValueCents: price?.averageEstimateCents ?? null,
          condition: form.conditionNotes.overall || null,
          notes: notes || null,
          status
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not save this card.");
        return;
      }
      setMessage("Saved to your collection.");
      await loadCollection();
    } catch {
      setMessage("Could not save this card.");
    } finally {
      setBusy(null);
    }
  }

  async function loadDeals() {
    setBusy("deals");
    try {
      const response = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: dealSearchCards })
      });
      const data = await response.json();
      setDealFinds(data.finds ?? []);
      setDealMessage(data.message ?? "");
    } catch {
      setDealFinds([]);
      setDealMessage("Live deal finder not connected yet.");
    } finally {
      setBusy(null);
    }
  }

  async function loadMarketGallery(search = marketSearch, demo = marketDemoMode, force = false) {
    const normalizedSearch = search.trim();
    const exactSearchRequested = Boolean(normalizedSearch);
    if (marketGalleryLoadingRef.current) {
      if (normalizedSearch) {
        marketGalleryQueueRef.current += 1;
        pendingMarketSearchRef.current = { search, demo, force: true };
        setMarketMessage("Finishing current market request, then searching your query.");
      }
      return;
    }
    if (!force && !normalizedSearch && marketHasLoaded && marketListings.length > 0) return;
    const queueId = marketGalleryQueueRef.current + 1;
    marketGalleryQueueRef.current = queueId;
    marketGalleryLoadingRef.current = true;
    setMarketLoading(true);
    setMarketError(null);
    setBusy("market");
    if (marketListings.length === 0) setMarketMessage("Loading live marketplace listings...");
    try {
      const queries = normalizedSearch ? [toPlayerMarketQuery(normalizedSearch)] : [""];
      let failedRequests = 0;
      let rateLimited = false;
      let usedFallbackSearch = false;
      const batches: Array<{ message: string | null | undefined; status: string | undefined; listings: MarketGalleryListing[] }> = [];
      for (const query of queries) {
        if (queueId !== marketGalleryQueueRef.current) break;
        try {
          const cacheKey = `${demo ? "demo" : "live"}:${query || "default-feed"}`;
          let queryListings = marketGalleryCacheRef.current.get(cacheKey);
          let queryMessage: string | null | undefined = null;
          let queryStatus: string | undefined = "CACHED";
          if (!queryListings) {
            const params = new URLSearchParams();
            if (query) params.set("q", query);
            if (demo) params.set("demoMode", "true");
            const requestUrl = `/api/market/gallery?${params}`;
            setDiagnostics((current) => ({
              ...current,
              lastMarketRequest: requestUrl,
              lastMarketError: "",
              rateLimitHit: false
            }));
            const response = await fetch(requestUrl);
            const data = await response.json().catch(() => ({}));
            const errorMessage = data.error ?? data.message ?? "";
            if (!response.ok || String(errorMessage).toLowerCase().includes("too many market searches")) {
              if (String(errorMessage).toLowerCase().includes("too many market searches")) {
                rateLimited = true;
                setMarketMessage("Market search limit reached. Showing available results. Try again in a minute.");
                setMarketRetryLockedUntil(Date.now() + 5000);
                setTimeout(() => setMarketRetryLockedUntil(0), 5000);
                setDiagnostics((current) => ({
                  ...current,
                  lastMarketError: "Market search limit reached. Showing available results. Try again in a minute.",
                  rateLimitHit: true
                }));
                break;
              }
              failedRequests += 1;
              console.warn("Market Gallery query warning", query, errorMessage || response.statusText);
              setDiagnostics((current) => ({
                ...current,
                lastMarketError: String(errorMessage || response.statusText || "Market search failed.")
              }));
              queryListings = [];
              queryMessage = "Some market searches could not load.";
              queryStatus = "ERROR";
            } else {
              queryListings = ((data.listings ?? []) as MarketGalleryListing[]).filter((listing) => isQualityMarketListing(listing, { defaultFeed: !normalizedSearch }));
              setDiagnostics((current) => ({
                ...current,
                lastMarketResponseCount: queryListings?.length ?? 0,
                lastMarketRawCount: typeof data.rawCount === "number" ? data.rawCount : current.lastMarketRawCount,
                lastMarketFilteredCount: typeof data.filteredCount === "number" ? data.filteredCount : queryListings?.length ?? 0,
                lastMarketSampleTitles: Array.isArray(data.sampleTitles) ? data.sampleTitles.slice(0, 3).map(String) : current.lastMarketSampleTitles,
                lastMarketError: ""
              }));
              marketGalleryCacheRef.current.set(cacheKey, queryListings);
              queryMessage = data.message as string | null | undefined;
              queryStatus = data.status as string | undefined;
            }
          } else {
            setDiagnostics((current) => ({
              ...current,
              lastMarketRequest: `${demo ? "demo" : "live"}:${query} (cache)`,
              lastMarketResponseCount: queryListings?.length ?? 0,
              lastMarketFilteredCount: queryListings?.length ?? 0,
              lastMarketError: ""
            }));
          }
          batches.push({ message: queryMessage, status: queryStatus, listings: queryListings ?? [] });
          const nextBatchListings = batches.flatMap((batch) => batch.listings);
          const partialListings = mergeMarketListings(normalizedSearch ? nextBatchListings : [...marketListings, ...nextBatchListings]);
          if (partialListings.length > 0) setMarketListings(partialListings);
        } catch (error) {
          failedRequests += 1;
          console.warn("Market Gallery query warning", query, error);
          setDiagnostics((current) => ({
            ...current,
            lastMarketError: "Unable to load marketplace listings. Try again."
          }));
          batches.push({ message: null, status: "ERROR", listings: [] });
        }
          if (!normalizedSearch && query !== queries[queries.length - 1]) await sleep(800);
      }
      if (exactSearchRequested && !rateLimited && batches.flatMap((batch) => batch.listings).length === 0 && failedRequests < queries.length) {
        usedFallbackSearch = true;
        for (const query of fallbackMarketGalleryQueries) {
          if (queueId !== marketGalleryQueueRef.current) break;
          try {
            const cacheKey = `${demo ? "demo" : "live"}:${query}`;
            let queryListings = marketGalleryCacheRef.current.get(cacheKey);
            let queryMessage: string | null | undefined = null;
            let queryStatus: string | undefined = "CACHED";
            if (!queryListings) {
              const params = new URLSearchParams({ q: query });
              if (demo) params.set("demoMode", "true");
              const requestUrl = `/api/market/gallery?${params}`;
              setDiagnostics((current) => ({
                ...current,
                lastMarketRequest: requestUrl,
                lastMarketError: "",
                rateLimitHit: false
              }));
              const response = await fetch(requestUrl);
              const data = await response.json().catch(() => ({}));
              const errorMessage = data.error ?? data.message ?? "";
              if (!response.ok || String(errorMessage).toLowerCase().includes("too many market searches")) {
                if (String(errorMessage).toLowerCase().includes("too many market searches")) {
                  rateLimited = true;
                  setMarketMessage("Market search limit reached. Showing available results. Try again in a minute.");
                  setMarketRetryLockedUntil(Date.now() + 5000);
                  setTimeout(() => setMarketRetryLockedUntil(0), 5000);
                  setDiagnostics((current) => ({
                    ...current,
                    lastMarketError: "Market search limit reached. Showing available results. Try again in a minute.",
                    rateLimitHit: true
                  }));
                  break;
                }
                failedRequests += 1;
                console.warn("Market Gallery fallback query warning", query, errorMessage || response.statusText);
                queryListings = [];
                queryMessage = "Some broader market searches could not load.";
                queryStatus = "ERROR";
              } else {
                queryListings = ((data.listings ?? []) as MarketGalleryListing[]).filter((listing) => isQualityMarketListing(listing, { defaultFeed: true }));
                setDiagnostics((current) => ({
                  ...current,
                  lastMarketResponseCount: queryListings?.length ?? 0,
                  lastMarketRawCount: typeof data.rawCount === "number" ? data.rawCount : current.lastMarketRawCount,
                  lastMarketFilteredCount: typeof data.filteredCount === "number" ? data.filteredCount : queryListings?.length ?? 0,
                  lastMarketSampleTitles: Array.isArray(data.sampleTitles) ? data.sampleTitles.slice(0, 3).map(String) : current.lastMarketSampleTitles,
                  lastMarketError: ""
                }));
                marketGalleryCacheRef.current.set(cacheKey, queryListings);
                queryMessage = data.message as string | null | undefined;
                queryStatus = data.status as string | undefined;
              }
            }
            batches.push({ message: queryMessage, status: queryStatus, listings: queryListings ?? [] });
            const fallbackListings = mergeMarketListings(batches.flatMap((batch) => batch.listings));
            if (fallbackListings.length > 0) setMarketListings(fallbackListings);
          } catch (error) {
            failedRequests += 1;
            console.warn("Market Gallery fallback query warning", query, error);
            batches.push({ message: null, status: "ERROR", listings: [] });
          }
          if (query !== fallbackMarketGalleryQueries[fallbackMarketGalleryQueries.length - 1]) await sleep(800);
        }
      }
      const nextBatchListings = batches.flatMap((batch) => batch.listings);
      const mergedListings = mergeMarketListings(normalizedSearch ? nextBatchListings : [...marketListings, ...nextBatchListings]).slice(0, 60);
      console.log("Market Gallery listings returned", mergedListings.length);
      if (exactSearchRequested && mergedListings.length === 0 && defaultMarketListings.length > 0) {
        setMarketListings(defaultMarketListings);
      } else {
        setMarketListings(mergedListings);
      }
      if (!exactSearchRequested && mergedListings.length > 0) {
        setDefaultMarketListings(mergedListings);
      }
      if (!exactSearchRequested) {
        setDiagnostics((current) => ({
          ...current,
          defaultFeedLoaded: true,
          defaultFeedResultCount: mergedListings.length,
          lastDefaultQuery: "Default query pool"
        }));
      }
      const firstMessage = batches.find((batch) => batch.message)?.message ?? "";
      if (rateLimited) {
        setMarketMessage("Market search limit reached. Showing available results. Try again in a minute.");
        setMarketFeedLabel(defaultMarketListings.length > 0 ? "Default Market Feed" : exactSearchRequested ? "Search Results" : "Default Market Feed");
      } else if (mergedListings.length === 0 && failedRequests === queries.length) {
        setMarketError("Unable to load marketplace listings. Try again.");
        setMarketMessage("Unable to load marketplace listings. Try again.");
        setMarketFeedLabel(defaultMarketListings.length > 0 ? "Default Market Feed" : exactSearchRequested ? "Search Results" : "Default Market Feed");
      } else if (mergedListings.length === 0) {
        setMarketMessage(defaultMarketListings.length > 0
          ? "No active listings found for this exact search. Showing the last successful default feed."
          : exactSearchRequested
            ? "No active listings found for this exact search. Try a broader search or scan another card."
            : "No default market listings found. Try a player search.");
        setMarketFeedLabel(defaultMarketListings.length > 0 ? "Default Market Feed" : exactSearchRequested ? "Search Results" : "Default Market Feed");
      } else if (usedFallbackSearch) {
        setMarketMessage("No active listings found for this exact search. Showing broader market results instead.");
        setMarketFeedLabel("Search Results");
      } else {
        setMarketMessage(firstMessage || (exactSearchRequested ? "Search Results from eBay Active Listings." : "Default Market Feed from eBay Active Listings."));
        setMarketFeedLabel(exactSearchRequested ? "Search Results" : "Default Market Feed");
      }
      setMarketHasLoaded(true);
    } catch (error) {
      console.warn("Market Gallery load warning", error);
      if (marketListings.length === 0) setMarketError("Unable to load marketplace listings. Try again.");
      setMarketMessage("Unable to load marketplace listings. Try again.");
      setMarketHasLoaded(true);
    } finally {
      marketGalleryLoadingRef.current = false;
      setMarketLoading(false);
      setBusy((current) => (current === "market" ? null : current));
      const pending = pendingMarketSearchRef.current;
      if (pending) {
        pendingMarketSearchRef.current = null;
        setTimeout(() => void loadMarketGallery(pending.search, pending.demo, pending.force), 250);
      }
    }
  }

  function addFlip(record: Omit<FlipRecord, "id">) {
    setFlips((current) => [{ ...record, id: crypto.randomUUID() }, ...current]);
  }

  function updateFlip(id: string, patch: Partial<FlipRecord>) {
    setFlips((current) => current.map((flip) => (flip.id === id ? { ...flip, ...patch } : flip)));
  }

  function addManualComp(comp: Omit<ManualComp, "id">) {
    setManualComps((current) => [{ ...comp, id: crypto.randomUUID() }, ...current]);
  }

  function exportCollectionCsv() {
    downloadCsv("cardrate-collection.csv", [
      ["Player", "Sport", "Year", "Brand", "Set", "Parallel", "Team", "Estimated Value", "Purchase Price", "Status"],
      ...(collection?.items ?? []).map((item) => [
        item.card.playerName,
        item.card.sport,
        item.card.year ?? "",
        item.card.brand ?? "",
        item.card.setName ?? "",
        item.card.parallel ?? "",
        item.card.team ?? "",
        centsToCsvDollars(item.estimatedValueCents),
        centsToCsvDollars(item.purchasePriceCents),
        item.status
      ])
    ]);
  }

  function exportFlipsCsv() {
    downloadCsv("cardrate-flips.csv", [
      ["Player", "Card", "Status", "Purchase Date", "Purchase Price", "Source", "Listed Price", "Sold Price", "Sale Date", "Notes"],
      ...flips.map((flip) => [
        flip.player,
        flip.cardSummary,
        flip.status,
        flip.purchaseDate,
        flip.purchasePrice,
        flip.source,
        flip.listedPrice,
        flip.soldPrice,
        flip.saleDate,
        flip.notes
      ])
    ]);
  }

  function updateField<K extends keyof ScanResult>(key: K, value: ScanResult[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      uncertainFields: current.uncertainFields.filter((field) => field !== key)
    }));
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-[#070A12] pb-24 text-slate-100">
      <section className="px-4 pb-5 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">NoCaps CardRate</h1>
            <p className="mt-1 text-xs font-semibold text-slate-400">A NoCapsAI product</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-end">
            <img src="/assets/logo.png" alt="NoCapsAI logo" className="h-10 w-10 rounded-md object-contain" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <DarkMetric label="Cards" value={collection?.summary.totalCards ?? 0} />
          <DarkMetric label="Value" value={formatMoney(collection?.summary.totalValueCents ?? 0)} />
          <DarkMetric label="Sports" value={sportCount} />
        </div>
        <TabNav activeTab={activeTab} onChange={setActiveTab} />
        <SharedSportFilterChips active={activeSportFilter} onChange={setActiveSportFilter} />
      </section>

      {activeTab === "dashboard" && (
      <section className="px-4 sm:px-6">
        <DashboardPanel collection={collection} flips={flips} finds={dealFinds} marketListings={marketListings} marketLoading={!marketHasLoaded || marketLoading} marketMessage={marketMessage} marketFeedLabel={marketFeedLabel} activeSportFilter={activeSportFilter} isProUser={isProUser} onOpenDeals={() => setActiveTab("market")} onScan={() => setActiveTab("scan")} onAddFlip={addFlip} />
      </section>
      )}

      {activeTab === "scan" && (
      <>
      <section className="px-4 sm:px-6">
        <div className="rounded-md border border-white/10 bg-white/[0.06] p-4 shadow-lift sm:p-5">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-cobalt" aria-hidden="true" />
            <h2 className="text-lg font-black">Card scan</h2>
          </div>
          <p className="mt-2 text-sm text-slate-400">Front is required. Add the back to confirm card number, set, team, and copyright year.</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ImagePicker
              title="Front of card"
              required
              image={frontImage}
              onChange={(file) => void handleImage("front", file)}
            />
            <ImagePicker
              title="Back of card"
              image={backImage}
              onChange={(file) => void handleImage("back", file)}
            />
          </div>

          <button
            type="button"
            onClick={scanCard}
            disabled={busy === "scan"}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-base font-black text-white shadow-lift disabled:opacity-60"
          >
            {busy === "scan" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {busy === "scan" ? "Scanning card..." : "Scan with AI"}
          </button>

          {message && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              {message}
            </div>
          )}
        </div>
      </section>

      {scan && (
        <section className="mt-5 px-4 sm:px-6">
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-4 shadow-lift sm:p-5">
            <DetectedSummary card={form} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black">Review card</h2>
                <p className="text-xs text-slate-400">Highlighted fields need a human check before saving.</p>
              </div>
              <ConfidenceIndicator score={form.confidenceScore} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Player" value={form.playerName} uncertain={uncertain.has("playerName")} onChange={(value) => updateField("playerName", value)} />
              <SelectField value={form.sport} onChange={(value) => updateField("sport", value)} />
              <Field label="Year" value={form.year?.toString() ?? ""} uncertain={uncertain.has("year")} placeholder={reviewText} onChange={(value) => updateField("year", value ? Number(value) : null)} />
              <Field label="Brand" value={form.brand} uncertain={uncertain.has("brand")} onChange={(value) => updateField("brand", value)} />
              <Field label="Set" value={form.setName} uncertain={uncertain.has("setName")} onChange={(value) => updateField("setName", value)} />
              <Field label="Card #" value={form.cardNumber} uncertain={uncertain.has("cardNumber")} onChange={(value) => updateField("cardNumber", value)} />
              <Field label="Parallel" value={form.parallel} uncertain={uncertain.has("parallel")} onChange={(value) => updateField("parallel", value)} />
              <Field label="Serial #" value={form.serialNumber} uncertain={uncertain.has("serialNumber")} onChange={(value) => updateField("serialNumber", value)} />
              <Field label="Team" value={form.team} uncertain={uncertain.has("team")} onChange={(value) => updateField("team", value)} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Toggle label="Rookie" active={form.rookieFlag} onClick={() => updateField("rookieFlag", !form.rookieFlag)} />
              <Toggle label="Auto" active={form.autographFlag} onClick={() => updateField("autographFlag", !form.autographFlag)} />
              <Toggle label="Relic" active={form.relicFlag} onClick={() => updateField("relicFlag", !form.relicFlag)} />
            </div>

            {isLowNumbered(form.serialNumber) && (
              <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3">
                <p className="text-sm font-black text-amber-100">Low-numbered card detected</p>
                <p className="mt-1 text-xs font-semibold text-amber-100/80">Exact comps may be rare. Broader comps may be needed.</p>
              </div>
            )}

            <PossibleParallelsPanel card={form} loading={busy === "price"} selectedParallel={selectedParallel} onSearch={searchParallelComps} />

            <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cobalt" aria-hidden="true" />
                <h3 className="text-sm font-black">Grading helper</h3>
              </div>
              <p className="text-sm text-slate-300">{form.conditionNotes.overall || reviewText}</p>
              <p className="mt-2 text-xs font-semibold text-slate-400">
                {form.gradingHelper.worthConsidering ? "Worth considering: " : "Hold off for now: "}
                {form.gradingHelper.rationale || noRationaleText}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Purchase price" value={purchasePrice} onChange={setPurchasePrice} placeholder="0.00" />
              <label className="block">
                <span className="text-xs font-bold text-slate-400">Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white">
                  <option value="RAW">Raw</option>
                  <option value="GRADED">Graded</option>
                  <option value="LISTED">Listed</option>
                  <option value="SOLD">Sold</option>
                </select>
              </label>
              <Field label="Notes" value={notes} onChange={setNotes} placeholder="Vault, slab, lot..." />
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => {
                setSelectedParallel("");
                setPricingContextMessage("");
                void priceCard();
              }} disabled={busy === "price"} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/8 px-3 text-sm font-black text-white hover:bg-white/14 disabled:opacity-60">
                {busy === "price" ? <Loader2 className="h-5 w-5 animate-spin" /> : <BadgeDollarSign className="h-5 w-5" />}
                {form.parallel !== (scan?.parallel ?? "") ? "Re-price with edited details" : "Search comps"}
              </button>
              <button type="button" onClick={saveCard} disabled={busy === "save"} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-flame px-3 text-sm font-black text-white shadow-lift disabled:opacity-60">
                {busy === "save" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Save card
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="mt-5 px-4 sm:px-6">
        <PricingPanel
          price={price}
          broaderPrice={broaderPrice}
          broaderMessage={broaderMessage}
          activeAsks={activeAsks}
          activeAsksLoading={activeAsksLoading}
          loading={busy === "price"}
          broaderLoading={busy === "broad-price"}
          demoMode={demoMode}
          contextMessage={pricingContextMessage}
          onSearchBroader={() => void searchBroaderComps()}
        />
      </section>
      <section className="mt-5 px-4 sm:px-6">
        <ProfitEstimator
          title="Reviewed card profit"
          defaultPurchasePrice={purchasePrice}
          defaultTargetPrice={price?.averageEstimateCents ? (price.averageEstimateCents / 100).toFixed(2) : ""}
          onAddFlip={(record) => addFlip({
            ...record,
            player: form.playerName || "Unreviewed card",
            cardSummary: [form.year, form.brand, form.setName, form.cardNumber ? `#${form.cardNumber}` : null].filter(Boolean).join(" - ")
          })}
        />
      </section>
      </>
      )}

      {activeTab === "collection" && (
      <section className="px-4 sm:px-6">
        <CollectionPanel collection={collection} activeSportFilter={activeSportFilter} search={search} setSearch={setSearch} onAddFlip={addFlip} onExport={exportCollectionCsv} />
      </section>
      )}

      {activeTab === "deals" && (
      <section className="px-4 sm:px-6">
        <div className="mt-5">
          <ManualCompsPanel comps={manualComps} estimate={manualEstimate} onAdd={addManualComp} onRemove={(id) => setManualComps((current) => current.filter((comp) => comp.id !== id))} />
        </div>
        <div className="mt-5">
          <ManualListingPanel listing={manualListing} onChange={setManualListing} deal={manualDeal} onAddFlip={(record) => addFlip(record)} />
        </div>
        <div className="mt-5">
        <UndervaluedFindsPanel finds={dealFinds} message={dealMessage} loading={busy === "deals"} sort={dealSort} activeSportFilter={activeSportFilter} onSort={setDealSort} onRefresh={() => void loadDeals()} onAddFlip={addFlip} />
        </div>
      </section>
      )}

      {activeTab === "flips" && (
      <section className="px-4 sm:px-6">
        <FlipTrackerPanel flips={flips} activeSportFilter={activeSportFilter} onUpdate={updateFlip} onAdd={addFlip} onExport={exportFlipsCsv} />
      </section>
      )}

      {activeTab === "market" && (
      <section className="px-4 sm:px-6">
        <div className="mt-5">
          <MarketGalleryPanel
            listings={marketListings}
            message={marketError ?? marketMessage}
            error={marketError}
            loading={!marketHasLoaded || marketLoading}
            feedLabel={marketFeedLabel}
            activeSportFilter={activeSportFilter}
            search={marketSearch}
            filter={marketFilter}
            sort={marketSort}
            demoMode={marketDemoMode}
            demoAllowed={Boolean(appStatus?.demo.allowed)}
            retryLocked={Date.now() < marketRetryLockedUntil}
            onSearchChange={setMarketSearch}
            onFilter={setMarketFilter}
            onSort={setMarketSort}
            onDemoMode={(enabled) => {
              setMarketDemoMode(enabled);
              void loadMarketGallery(marketSearch, enabled, true);
            }}
            onRefresh={() => {
              if (Date.now() < marketRetryLockedUntil) return;
              void loadMarketGallery(marketSearch, marketDemoMode, true);
            }}
            onSearch={() => void loadMarketGallery(marketSearch, marketDemoMode, true)}
            onTryBroader={() => {
              setMarketSearch("");
              void loadMarketGallery("", marketDemoMode, true);
            }}
            onSuggestedSearch={(query) => {
              setMarketSearch(query);
              void loadMarketGallery(query, marketDemoMode, true);
            }}
            onAddFlip={addFlip}
          />
        </div>
      </section>
      )}

      <section className="mt-5 px-4 sm:px-6">
        <Disclaimer />
      </section>
    </main>
  );
}

function DataSourcesStatusPanel({ status }: { status: AppStatus | null }) {
  const ebayConnected = status?.ebay.status === "Connected";
  const sportsCardsProConnected = status?.sportsCardsPro?.status === "Connected";
  const sources = [
    { name: "eBay Sold Comps", state: ebayConnected ? "Connected" : "Not Connected", kind: ebayConnected ? "connected" : "disconnected" },
    { name: "eBay Active Listings", state: ebayConnected ? "Connected" : "Not Connected", kind: ebayConnected ? "connected" : "disconnected" },
    { name: "SportsCardsPro Price Guide", state: sportsCardsProConnected ? "Connected" : "Not Connected", kind: sportsCardsProConnected ? "connected" : "disconnected" },
    { name: "Card Ladder Historical Sales", state: "Future Provider", kind: "future" },
    { name: "Market Movers", state: "Future Provider", kind: "future" },
    { name: "Fanatics Collect Auctions", state: "Future Provider", kind: "future" },
    { name: "Alt", state: "Future Provider", kind: "future" }
  ];

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3 shadow-lift">
      <div className="flex items-center gap-2">
        <PlugZap className="h-4 w-4 text-emerald-300" aria-hidden="true" />
        <h2 className="text-sm font-black text-white">Data Sources</h2>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {sources.map((source) => (
          <div key={source.name} className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-white">{source.name}</p>
              <span className={`rounded-md px-2 py-1 text-[11px] font-black ${source.kind === "connected" ? "bg-emerald-400/15 text-emerald-300" : source.kind === "future" ? "bg-amber-300/15 text-amber-200" : "bg-white/8 text-slate-300"}`}>
                {source.state}
              </span>
            </div>
            {source.kind !== "connected" && (
              <p className="mt-2 text-xs font-semibold text-slate-400">Available later. Current pricing uses eBay sold comps.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DiagnosticItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-sky-300/15 bg-black/20 p-2">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-sky-200">{label}</p>
      <p className="mt-1 break-words text-xs font-semibold text-sky-50/80">{value}</p>
    </div>
  );
}

async function compressImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPEG, PNG, or WebP image.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxImageSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare this image.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.9, 0.84, 0.78]) {
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (blob.size <= maxUploadBytes || quality === 0.78) {
      return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
    }
  }
  return file;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not compress image."))), type, quality);
  });
}

function normalizeClientScan(value: Partial<ScanResult>): ScanResult {
  const notes = value.conditionNotes ?? emptyResult.conditionNotes;
  const helper = value.gradingHelper ?? emptyResult.gradingHelper;
  return {
    ...emptyResult,
    ...value,
    sport: value.sport ?? "OTHER",
    playerName: value.playerName || reviewText,
    brand: value.brand || reviewText,
    setName: value.setName || reviewText,
    cardNumber: value.cardNumber || reviewText,
    parallel: value.parallel || "",
    serialNumber: value.serialNumber || "",
    team: value.team || reviewText,
    confidenceScore: value.confidenceScore ?? 0,
    conditionNotes: {
      centering: notes.centering || reviewText,
      corners: notes.corners || reviewText,
      edges: notes.edges || reviewText,
      surface: notes.surface || reviewText,
      overall: notes.overall || reviewText
    },
    gradingHelper: {
      worthConsidering: helper.worthConsidering ?? false,
      rationale: helper.rationale || noRationaleText
    },
    uncertainFields: value.uncertainFields ?? []
  };
}

function ImagePicker({
  title,
  required,
  image,
  onChange
}: {
  title: string;
  required?: boolean;
  image: PreparedImage | null;
  onChange: (file?: File | null) => void;
}) {
  return (
    <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-white/15 bg-black/20 p-4 text-center transition hover:border-emerald-300/40 hover:bg-black/30">
      {image ? (
        <>
          <img src={image.previewUrl} alt={`${title} preview`} className="max-h-56 rounded-md object-contain" />
          <span className="mt-2 text-xs font-semibold text-slate-400">
            Prepared {bytesToMb(image.file.size)} MB from {bytesToMb(image.originalSize)} MB
          </span>
        </>
      ) : (
        <>
          {required ? <Upload className="h-10 w-10 text-slate-500" aria-hidden="true" /> : <ImagePlus className="h-10 w-10 text-slate-500" aria-hidden="true" />}
          <span className="mt-3 text-base font-black">{title}</span>
          <span className="mt-1 text-xs text-slate-400">{required ? "Required" : "Recommended"} up to 15 MB after compression</span>
        </>
      )}
      <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => onChange(event.target.files?.[0])} />
    </label>
  );
}

function bytesToMb(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1);
}

function formatValueOrPending(cents?: number | null) {
  return cents && cents > 0 ? formatMoney(cents) : "Pricing pending";
}

function DashboardPanel({
  collection,
  flips,
  finds,
  marketListings,
  marketLoading,
  marketMessage,
  marketFeedLabel,
  activeSportFilter,
  isProUser,
  onOpenDeals,
  onScan,
  onAddFlip
}: {
  collection: CollectionResponse | null;
  flips: FlipRecord[];
  finds: DealFind[];
  marketListings: MarketGalleryListing[];
  marketLoading: boolean;
  marketMessage: string;
  marketFeedLabel: string;
  activeSportFilter: SharedSportFilter;
  isProUser: boolean;
  onOpenDeals: () => void;
  onScan: () => void;
  onAddFlip: (record: Omit<FlipRecord, "id">) => void;
}) {
  const items = collection?.items ?? [];
  const totalValue = collection?.summary.totalValueCents ?? 0;
  const filteredFinds = finds.filter((find) => dealMatchesSharedSport(find, activeSportFilter));
  const filteredFlips = flips.filter((flip) => flipMatchesSharedSport(flip, activeSportFilter));
  const filteredMarketListings = marketListings.filter((listing) => listingMatchesSharedSport(listing, activeSportFilter));
  const totalInvested = filteredFlips.reduce((sum, flip) => sum + flip.purchasePrice, 0);
  const soldFlips = filteredFlips.filter((flip) => flip.status === "Sold");
  const realizedProfit = soldFlips.reduce((sum, flip) => sum + flip.soldPrice - flip.purchasePrice, 0);
  const projectedValue = filteredFlips.reduce((sum, flip) => sum + (flip.listedPrice || flip.soldPrice), 0);
  const purchaseBasisCents = items.reduce((sum, item) => sum + (item.purchasePriceCents ?? 0), 0) + Math.round(totalInvested * 100);
  const unrealizedProfitCents = purchaseBasisCents > 0 ? totalValue + Math.round(projectedValue * 100) - purchaseBasisCents : null;
  const dailyChange = 0;
  const weeklyChange = 0;
  const mostValuable = collection?.summary.highestValueCards ?? [];
  const recent = [
    ...items.slice(0, 3).map((item) => ({ label: "Saved card", title: item.card.playerName, detail: formatValueOrPending(item.estimatedValueCents) })),
    ...filteredFlips.slice(0, 3).map((flip) => ({ label: flip.status, title: flip.player, detail: flip.cardSummary || "Flip tracked" }))
  ].slice(0, 5);
  const sportTotals = Object.entries(collection?.summary.sportTotals ?? {}).sort((a, b) => b[1] - a[1]);
  const topDeals = [...filteredFinds].sort((a, b) => b.flipScore - a.flipScore).slice(0, 3);
  const gainers = topDeals.filter((deal) => (deal.estimatedUpsideCents ?? 0) > 0);
  const losers = [...items]
    .filter((item) => item.purchasePriceCents != null && item.estimatedValueCents != null && (item.estimatedValueCents ?? 0) < (item.purchasePriceCents ?? 0))
    .sort((a, b) => ((a.estimatedValueCents ?? 0) - (a.purchasePriceCents ?? 0)) - ((b.estimatedValueCents ?? 0) - (b.purchasePriceCents ?? 0)))
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-md border border-white/10 bg-white/[0.06] p-5 shadow-lift backdrop-blur">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">NoCaps CardRate</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">A NoCapsAI product</p>
          </div>
          <button type="button" onClick={onScan} className="flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 text-sm font-black text-[#070A12] shadow-lift transition hover:bg-emerald-300">
            <Camera className="h-4 w-4" aria-hidden="true" />
            Scan Card
          </button>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Total Collection Value</p>
            <h2 className="mt-2 text-4xl font-black text-white">{formatMoney(totalValue)}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <ChangePill label="Daily" cents={dailyChange} empty />
              <ChangePill label="Weekly" cents={weeklyChange} empty />
            </div>
          </div>
          <ProBadge isProUser={isProUser} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <PremiumMetric label="Collection" title="Saved Cards" value={items.length} icon={<ListChecks className="h-4 w-4" />} />
          <PremiumMetric label="Holdings" title="Invested" value={formatMoney(purchaseBasisCents)} icon={<Database className="h-4 w-4" />} />
          <PremiumMetric label="Projected" title="Unrealized P/L" value={unrealizedProfitCents == null ? "Needs basis" : formatMoney(unrealizedProfitCents)} tone={unrealizedProfitCents == null ? undefined : unrealizedProfitCents >= 0 ? "gain" : "loss"} icon={<TrendingUp className="h-4 w-4" />} />
          <PremiumMetric label="Realized" title="Closed P/L" value={formatMoney(Math.round(realizedProfit * 100))} tone={realizedProfit >= 0 ? "gain" : "loss"} icon={<BadgeDollarSign className="h-4 w-4" />} />
          <PremiumMetric label="Active" title="Flips" value={filteredFlips.filter((flip) => !["Sold", "Passed"].includes(flip.status)).length} icon={<Target className="h-4 w-4" />} />
        </div>
      </section>

      <PortfolioTrendCard />

      <MarketSpotlightSection listings={getPremiumMarketListings(filteredMarketListings).slice(0, 6)} loading={marketLoading} message={marketMessage} feedLabel={marketFeedLabel} activeSportFilter={activeSportFilter} onOpenDeals={onOpenDeals} onAddFlip={onAddFlip} />

      <section className="grid gap-4 md:grid-cols-2">
        <PremiumBlock title="Top Gainers" icon={<ArrowUpRight className="h-4 w-4" />}>
          {gainers.length === 0 ? (
            <EmptyState title="No gainers yet" body="Price cards to start tracking movement." />
          ) : (
            gainers.map((deal) => <MoverRow key={deal.listingUrl} name={deal.player} value={deal.estimatedUpsideCents} score={deal.flipScore} positive />)
          )}
        </PremiumBlock>
        <PremiumBlock title="Top Losers" icon={<ArrowDownRight className="h-4 w-4" />}>
          {losers.length === 0 ? (
            <EmptyState title="No downside signals" body="Add purchase prices to compare basis against current value." />
          ) : (
            losers.map((item) => (
              <MoverRow
                key={item.id}
                name={item.card.playerName}
                value={(item.estimatedValueCents ?? 0) - (item.purchasePriceCents ?? 0)}
                score={Math.max(1, Math.round(((item.estimatedValueCents ?? 0) / Math.max(1, item.purchasePriceCents ?? 1)) * 100))}
              />
            ))
          )}
        </PremiumBlock>
      </section>

      <PremiumBlock title="Most Valuable Cards" icon={<Crown className="h-4 w-4" />}>
        {mostValuable.length === 0 ? (
          <EmptyState title="No holdings yet" body="Scan and save your first card to build your command center." />
        ) : (
          mostValuable.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b border-white/8 py-3 last:border-0">
              <div>
                <p className="font-black text-white">{item.card.playerName}</p>
                <p className="text-xs font-semibold text-slate-400">{[item.card.year, item.card.brand, item.card.setName].filter(Boolean).join(" - ")}</p>
              </div>
              <p className="font-black text-emerald-300">{formatValueOrPending(item.estimatedValueCents)}</p>
            </div>
          ))
        )}
      </PremiumBlock>

      <section className="grid gap-4 md:grid-cols-2">
        <PremiumBlock title="Undervalued Finds Preview" icon={<TrendingUp className="h-4 w-4" />}>
          {topDeals.length === 0 ? (
            <EmptyState title="No active flips yet" body="Add purchase price to unlock flip tracking." />
          ) : (
            topDeals.map((deal) => (
              <div key={deal.listingUrl} className="flex items-center justify-between border-b border-white/8 py-3 last:border-0">
                <div>
                  <p className="font-bold text-white">{deal.player}</p>
                  <p className="text-xs font-semibold text-slate-400">Flip Score {deal.flipScore} - {deal.flipScoreLabel}</p>
                </div>
                <p className="font-black text-emerald-300">{formatMoney(deal.estimatedUpsideCents)}</p>
              </div>
            ))
          )}
        </PremiumBlock>
        <PremiumBlock title="Portfolio Breakdown" icon={<BarChart3 className="h-4 w-4" />}>
          {sportTotals.length === 0 ? (
            <EmptyState title="No breakdown yet" body="Sport allocation appears once cards are saved." />
          ) : (
            sportTotals.map(([sport, cents]) => (
              <div key={sport} className="py-2">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span className="text-slate-200">{sport}</span>
                  <span className="text-white">{formatMoney(cents)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.min(100, totalValue ? (cents / totalValue) * 100 : 0)}%` }} />
                </div>
              </div>
            ))
          )}
        </PremiumBlock>
        <PremiumBlock title="Recent Activity" icon={<Activity className="h-4 w-4" />}>
          {recent.length === 0 ? (
            <EmptyState title="No activity yet" body="Scans, saves, flips, and sales will appear here." />
          ) : (
            recent.map((event, index) => (
              <div key={`${event.title}-${index}`} className="flex items-center justify-between border-b border-white/8 py-3 last:border-0">
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">{event.label}</p>
                  <p className="font-bold text-white">{event.title}</p>
                </div>
                <p className="text-xs font-bold text-slate-400">{event.detail}</p>
              </div>
            ))
          )}
        </PremiumBlock>
      </section>

      <ProCallout isProUser={isProUser} onOpenDeals={onOpenDeals} />
    </div>
  );
}

function PremiumBlock({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-5 shadow-lift backdrop-blur transition hover:border-white/16 hover:bg-white/[0.08]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-200">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/8 text-emerald-300">{icon}</span>
          <h3 className="text-sm font-black uppercase tracking-[0.14em]">{title}</h3>
        </div>
      </div>
      {children}
    </div>
  );
}

function PremiumMetric({
  label,
  title,
  value,
  tone,
  icon
}: {
  label: string;
  title: string;
  value: string | number;
  tone?: "gain" | "loss";
  icon: ReactNode;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.035] p-4 shadow-lift">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${tone === "gain" ? "bg-emerald-400/15 text-emerald-300" : tone === "loss" ? "bg-red-400/15 text-red-300" : "bg-white/8 text-slate-300"}`}>
          {icon}
        </span>
      </div>
      <p className="mt-4 text-xs font-bold text-slate-400">{title}</p>
      <p className={`mt-1 truncate text-xl font-black ${tone === "gain" ? "text-emerald-300" : tone === "loss" ? "text-red-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function DarkMetric({ label, value, tone }: { label: string; value: string | number; tone?: "gain" | "loss" }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-lg font-black ${tone === "gain" ? "text-emerald-300" : tone === "loss" ? "text-red-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function PortfolioTrendCard() {
  const ranges = ["1D", "7D", "30D", "90D", "ALL"];
  const [range, setRange] = useState("30D");

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-5 shadow-lift backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-200">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/8 text-emerald-300">
            <LineChart className="h-4 w-4" aria-hidden="true" />
          </span>
          <h3 className="text-sm font-black uppercase tracking-[0.14em]">Portfolio Value Trend</h3>
        </div>
        <div className="flex gap-1">
          {ranges.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`h-8 rounded px-2 text-xs font-black ${range === item ? "bg-emerald-400 text-[#070A12]" : "bg-white/8 text-slate-400 hover:bg-white/14"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 h-40 rounded-md border border-dashed border-white/10 bg-black/20 p-4">
        <div className="flex h-full flex-col justify-between">
          <div>
            <p className="text-sm font-black text-white">Historical tracking starts after saved value snapshots.</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">No real trend line is shown until portfolio history exists.</p>
          </div>
          <div className="relative h-16 overflow-hidden">
            <div className="absolute bottom-2 left-0 h-px w-full bg-white/10" />
            <div className="absolute bottom-2 left-0 h-10 w-full rounded-[50%] border-t-2 border-dashed border-emerald-300/40" />
            <div className="absolute bottom-7 left-[18%] h-2 w-2 rounded-full bg-emerald-300/50" />
            <div className="absolute bottom-10 left-[48%] h-2 w-2 rounded-full bg-emerald-300/50" />
            <div className="absolute bottom-12 left-[78%] h-2 w-2 rounded-full bg-emerald-300/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketSpotlightSection({
  listings,
  loading,
  message,
  feedLabel,
  activeSportFilter,
  onOpenDeals,
  onAddFlip
}: {
  listings: MarketGalleryListing[];
  loading: boolean;
  message: string;
  feedLabel: string;
  activeSportFilter: SharedSportFilter;
  onOpenDeals: () => void;
  onAddFlip: (record: Omit<FlipRecord, "id">) => void;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-white/[0.06] p-5 shadow-lift backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-200">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-300/15 text-amber-200">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <h3 className="text-sm font-black uppercase tracking-[0.14em]">Market Spotlight</h3>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-400">Live cards currently listed across the market.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md bg-sky-300/10 px-2 py-1 text-xs font-black text-sky-200">Dashboard Spotlight from eBay Active Listings · {sharedSportFilterLabel(activeSportFilter)}</span>
            <span className="rounded-md bg-white/8 px-2 py-1 text-xs font-black text-slate-300">{feedLabel}</span>
          </div>
        </div>
        <button type="button" onClick={onOpenDeals} className="rounded-md bg-white/8 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/14">
          Open Market
        </button>
      </div>
      {loading && listings.length === 0 ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <MarketSkeletonCard key={index} />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-white/10 bg-black/20 p-4">
          <p className="text-sm font-black text-white">{sharedSportEmptyMessage(activeSportFilter, message || "No active listings found for this exact search.")}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">Open Market to try broader searches like football rookie card, 2023 Prizm football, or Topps Chrome rookie.</p>
        </div>
      ) : (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <MarketListingCard key={listing.id} listing={listing} onAddFlip={onAddFlip} compact />
          ))}
        </div>
      )}
    </section>
  );
}

function toPlayerMarketQuery(search: string) {
  return /\bsports?\s+card\b/i.test(search) ? search : `${search} sports card`;
}

function sharedSportFilterLabel(filter: SharedSportFilter) {
  if (filter === "football") return "Football";
  if (filter === "baseball") return "Baseball";
  if (filter === "basketball") return "Basketball";
  return "All Sports";
}

function sharedSportEmptyMessage(filter: SharedSportFilter, fallback: string) {
  if (filter === "football") return "No football cards found in this view yet.";
  if (filter === "baseball") return "No baseball cards found in this view yet.";
  if (filter === "basketball") return "No basketball cards found in this view yet.";
  return fallback;
}

function sharedSportFilterToApiSport(filter: SharedSportFilter) {
  if (filter === "football") return "FOOTBALL";
  if (filter === "baseball") return "BASEBALL";
  if (filter === "basketball") return "BASKETBALL";
  return null;
}

function listingMatchesSharedSport(listing: MarketGalleryListing, filter: SharedSportFilter) {
  if (filter === "all") return true;
  return listing.sport.toLowerCase() === filter || sportTextMatchesFilter(listing.title, filter);
}

function dealMatchesSharedSport(find: DealFind, filter: SharedSportFilter) {
  if (filter === "all") return true;
  return String(find.sport).toLowerCase() === filter || sportTextMatchesFilter(`${find.player} ${find.brandSet} ${find.listingTitle}`, filter);
}

function flipMatchesSharedSport(flip: FlipRecord, filter: SharedSportFilter) {
  if (filter === "all") return true;
  return sportTextMatchesFilter(`${flip.player} ${flip.cardSummary} ${flip.source} ${flip.notes}`, filter);
}

function sportTextMatchesFilter(text: string, filter: SharedSportFilter) {
  if (filter === "football") return marketFootballPattern.test(text);
  if (filter === "baseball") return marketBaseballPattern.test(text);
  if (filter === "basketball") return marketBasketballPattern.test(text);
  return true;
}

function mergeMarketListings(listings: MarketGalleryListing[]) {
  const seen = new Set<string>();
  return listings.filter((listing) => {
    const key = listing.id || listing.listingUrl;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isQualityMarketListing(listing: MarketGalleryListing, options: { defaultFeed?: boolean } = {}) {
  const title = listing.title.toLowerCase();
  if (marketJunkTerms.some((term) => title.includes(term))) return false;
  if (!marketCardSignalPattern.test(title)) return false;
  if (options.defaultFeed && listing.listedPriceCents < 1000) return false;
  return true;
}

function matchesMarketFilter(listing: MarketGalleryListing, filter: MarketFilter) {
  if (filter === "All") return true;
  const title = listing.title.toLowerCase();
  if (filter === "Football") return listing.sport === "Football" || marketFootballPattern.test(title);
  if (filter === "Baseball") return listing.sport === "Baseball" || marketBaseballPattern.test(title);
  if (filter === "Basketball") return listing.sport === "Basketball" || marketBasketballPattern.test(title);
  if (filter === "Graded") return /\b(psa|bgs|sgc|slab|graded|gem mt|gem mint)\b/i.test(title) || listing.tags.includes("Graded");
  if (filter === "Autos") return /\b(auto|autograph|signed)\b/i.test(title) || listing.tags.includes("Autos");
  if (filter === "Numbered") return /\b(numbered|serial)\b|\/(10|25|50|99|199)\b/i.test(title) || listing.tags.includes("Numbered");
  return true;
}

function getMarketPremiumScore(listing: MarketGalleryListing) {
  const title = listing.title.toLowerCase();
  let score = 0;
  if (/\b(psa|bgs|sgc|slab|graded|gem mt|gem mint)\b/.test(title) || listing.tags.includes("Graded")) score += 45;
  if (/\b(auto|autograph|signed)\b/.test(title) || listing.tags.includes("Autos")) score += 35;
  if (/\b(rookie|rc)\b/.test(title) || listing.tags.includes("Rookie")) score += 30;
  if (/\b(numbered|serial)\b|\/(10|25|50|99|199)\b/.test(title) || listing.tags.includes("Numbered")) score += 25;
  if (listing.tags.includes("Trending")) score += 12;
  if (listing.tags.includes("Recently Listed")) score += 8;
  score += Math.min(40, listing.listedPriceCents / 2500);
  return score;
}

function getPremiumMarketListings(listings: MarketGalleryListing[]) {
  return [...listings].sort((a, b) => getMarketPremiumScore(b) - getMarketPremiumScore(a));
}

const marketJunkTerms = [
  "centering tool",
  "card centering",
  "display frame",
  "frame",
  "holder",
  "stand",
  "case",
  "supplies",
  "lot of sleeves",
  "penny sleeves",
  "top loader",
  "toploader",
  "binder",
  "box only",
  "empty box",
  "digital",
  "custom",
  "reprint",
  "proxy",
  "pokémon",
  "pokemon",
  "tcg",
  "magic",
  "yu-gi-oh",
  "cricket",
  "soccer",
  "wwe",
  "ufc"
];

const marketCardSignalPattern = /\b(card|cards|rookie|rc|psa|bgs|sgc|auto|autograph|patch|refractor|prizm|chrome|bowman|topps|panini|numbered)\b|\/(10|25|50|99|199)\b/i;
const marketFootballPattern = /\b(football|nfl|chiefs|texans|bears|jets|quarterback|qb|wr|rb|te|mahomes|stroud|caleb williams|garrett wilson)\b/i;
const marketBaseballPattern = /\b(baseball|mlb|bowman|ohtani|elly de la cruz|jackson holliday|yankees|dodgers|orioles|reds)\b/i;
const marketBasketballPattern = /\b(basketball|nba|wembanyama|anthony edwards|luka doncic|spurs|mavericks|timberwolves|hoops)\b/i;

function MarketGalleryPanel({
  listings,
  message,
  error,
  loading,
  feedLabel,
  activeSportFilter,
  search,
  filter,
  sort,
  demoMode,
  demoAllowed,
  retryLocked,
  onSearchChange,
  onFilter,
  onSort,
  onDemoMode,
  onRefresh,
  onSearch,
  onTryBroader,
  onSuggestedSearch,
  onAddFlip
}: {
  listings: MarketGalleryListing[];
  message: string;
  error: string | null;
  loading: boolean;
  feedLabel: string;
  activeSportFilter: SharedSportFilter;
  search: string;
  filter: MarketFilter;
  sort: MarketSort;
  demoMode: boolean;
  demoAllowed: boolean;
  retryLocked: boolean;
  onSearchChange: (value: string) => void;
  onFilter: (filter: MarketFilter) => void;
  onSort: (sort: MarketSort) => void;
  onDemoMode: (value: boolean) => void;
  onRefresh: () => void;
  onSearch: () => void;
  onTryBroader: () => void;
  onSuggestedSearch: (query: string) => void;
  onAddFlip: (record: Omit<FlipRecord, "id">) => void;
}) {
  const filters: MarketFilter[] = ["All", "Football", "Baseball", "Basketball", "Graded", "Autos", "Numbered"];
  const sorts: MarketSort[] = ["Best Match", "Highest Price", "Lowest Price", "Newly Listed", "Premium First"];
  const suggestedSearches = ["football rookie card", "CJ Stroud rookie", "2023 Prizm football", "Topps Chrome rookie"];
  const visible = [...listings]
    .filter((listing) => listingMatchesSharedSport(listing, activeSportFilter))
    .filter((listing) => matchesMarketFilter(listing, filter))
    .sort((a, b) => {
      if (sort === "Lowest Price") return a.listedPriceCents - b.listedPriceCents;
      if (sort === "Highest Price") return b.listedPriceCents - a.listedPriceCents;
      if (sort === "Newly Listed") return new Date(b.listedAt ?? 0).getTime() - new Date(a.listedAt ?? 0).getTime();
      if (sort === "Premium First") return getMarketPremiumScore(b) - getMarketPremiumScore(a);
      return 0;
    });

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-4 shadow-lift sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Market Gallery</p>
          <h2 className="mt-1 text-2xl font-black text-white">Browse active trading card listings</h2>
          <p className="mt-2 text-sm font-semibold text-slate-400">Live {providerSourceLabels.ebayActiveListings} when connected. These are asking prices, not completed sales or verified values.</p>
          <p className="mt-2 inline-flex rounded-md bg-sky-300/10 px-2 py-1 text-xs font-black text-sky-200">{feedLabel}</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading || retryLocked} className="h-12 w-full rounded-md bg-emerald-400 px-4 text-sm font-black text-[#070A12] hover:bg-emerald-300 disabled:opacity-60 sm:w-auto">
          {loading ? "Loading" : retryLocked ? "Wait" : "Refresh"}
        </button>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} onKeyDown={(event) => event.key === "Enter" && !loading && !retryLocked && onSearch()} placeholder="Search player, team, set, rookie, auto..." className="h-12 flex-1 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-emerald-300/60" />
        <button type="button" onClick={onSearch} disabled={loading || retryLocked} className="h-12 rounded-md bg-emerald-400 px-4 text-sm font-black text-[#070A12] transition hover:bg-emerald-300 disabled:opacity-60">Search active listings</button>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {filters.map((item) => (
          <button key={item} type="button" onClick={() => onFilter(item)} className={`h-10 shrink-0 rounded-full px-4 text-xs font-black ${filter === item ? "bg-emerald-400 text-[#070A12]" : "bg-white/8 text-slate-300 hover:bg-white/14"}`}>{item}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <input type="checkbox" checked={demoMode} disabled={!demoAllowed} onChange={(event) => onDemoMode(event.target.checked)} />
          Demo Mode
        </label>
        <select value={sort} onChange={(event) => onSort(event.target.value as MarketSort)} className="h-12 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm font-black text-white outline-none sm:w-auto">
          {sorts.map((item) => <option key={item} value={item} className="bg-[#070A12] text-white">{item}</option>)}
        </select>
      </div>
      {demoMode && <p className="mt-2 rounded-md bg-amber-300/10 p-2 text-xs font-black text-amber-200">Demo/Test Data only. Not live marketplace data.</p>}
      {!loading && listings.length > 0 && message && (
        <p className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/10 p-2 text-xs font-black text-amber-100">{message}</p>
      )}
      {loading && listings.length === 0 ? (
        <>
          <p className="mt-4 text-sm font-semibold text-slate-400">Searching market listings...</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <MarketSkeletonCard key={index} />)}</div>
        </>
      ) : error ? (
        <div className="mt-5 rounded-md border border-dashed border-red-400/20 bg-red-400/10 p-4">
          <p className="text-sm font-black text-white">Unable to load marketplace listings. Try again.</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">The gallery could not reach the marketplace feed.</p>
          <button type="button" onClick={onRefresh} disabled={retryLocked} className="mt-3 h-12 w-full rounded-md bg-emerald-400 px-4 text-sm font-black text-[#070A12] transition hover:bg-emerald-300 disabled:opacity-60 sm:w-auto">{retryLocked ? "Try again soon" : "Retry"}</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-white/10 bg-black/20 p-4">
          <p className="text-sm font-black text-white">{sharedSportEmptyMessage(activeSportFilter, message || "No active listings found for this exact search. Try a broader search or scan another card.")}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">eBay is connected, but this query returned no usable sports-card listings after filtering.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestedSearches.map((query) => (
              <button
                key={query}
                type="button"
                onClick={() => onSuggestedSearch(query)}
                disabled={retryLocked}
                className="h-10 rounded-full border border-white/10 bg-white/8 px-3 text-xs font-black text-slate-200 transition hover:bg-white/14 disabled:opacity-60"
              >
                {query}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onTryBroader} disabled={retryLocked} className="h-12 rounded-md bg-emerald-400 px-4 text-sm font-black text-[#070A12] transition hover:bg-emerald-300 disabled:opacity-60">Try broader search</button>
            <button type="button" onClick={onRefresh} disabled={retryLocked} className="h-12 rounded-md border border-white/10 bg-white/8 px-4 text-sm font-black text-white transition hover:bg-white/14 disabled:opacity-60">{retryLocked ? "Try again soon" : "Retry exact search"}</button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((listing) => <MarketListingCard key={listing.id} listing={listing} onAddFlip={onAddFlip} />)}</div>
      )}
    </div>
  );
}

function MarketSkeletonCard() {
  return (
    <div className="flex min-h-[440px] flex-col overflow-hidden rounded-md border border-white/10 bg-black/30 shadow-lift">
      <div className="flex h-52 max-h-52 items-center justify-center border-b border-white/10 bg-gradient-to-br from-[#05070d] via-slate-950 to-black p-3">
        <div className="h-40 w-28 animate-pulse rounded bg-white/8" />
      </div>
      <div className="flex flex-1 flex-col space-y-3 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
        <div className="h-16 animate-pulse rounded bg-white/8" />
        <div className="mt-auto grid grid-cols-1 gap-2 pt-3 min-[420px]:grid-cols-3">
          <div className="h-11 animate-pulse rounded bg-white/10" />
          <div className="h-11 animate-pulse rounded bg-white/10" />
          <div className="h-11 animate-pulse rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}

function MarketListingCard({ listing, onAddFlip, compact }: { listing: MarketGalleryListing; onAddFlip: (record: Omit<FlipRecord, "id">) => void; compact?: boolean }) {
  const badge = getMarketListingBadge(listing);
  const displayTags = listing.tags.filter((tag) => ["Rookie", "Graded", "Autos", "Numbered", "Trending", "Recently Listed"].includes(tag)).slice(0, 4);
  return (
    <article className={`${compact ? "min-w-[272px] md:min-w-0" : ""} flex min-h-[440px] flex-col overflow-hidden rounded-md border border-white/10 bg-black/30 shadow-lift transition duration-200 hover:-translate-y-1 hover:border-emerald-300/50 hover:bg-black/20`}>
      <div className="relative flex h-52 max-h-52 items-center justify-center overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#05070d] via-slate-950 to-black p-3">
        {listing.imageUrl ? <img src={listing.imageUrl} alt={listing.title} className="max-h-full max-w-full object-contain" /> : <div className="flex h-32 w-24 rotate-3 items-center justify-center rounded border border-white/15 bg-white/8 shadow-lift"><Sparkles className="h-6 w-6 text-emerald-200/70" aria-hidden="true" /></div>}
        <span className={`absolute left-3 top-3 rounded-md px-2 py-1 text-xs font-black ${badge.tone}`}>{badge.label}</span>
        {listing.isDemo && <span className="absolute right-3 top-3 rounded-md bg-amber-300 px-2 py-1 text-xs font-black text-[#070A12]">Demo/Test Data</span>}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 min-h-11 text-sm font-black leading-5 text-white">{listing.title}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <SportBadge sport={listing.sport} />
          <span className="shrink-0 rounded bg-sky-300/10 px-2 py-1 text-[11px] font-black text-sky-200">{listing.isDemo ? "Demo/Test Data" : listing.source}</span>
        </div>
        {displayTags.length > 0 && (
          <div className="mt-3 flex min-h-7 flex-wrap gap-1">
            {displayTags.map((tag) => (
              <span key={tag} className="rounded bg-white/8 px-2 py-1 text-[10px] font-black text-slate-300">{tag === "Autos" ? "Auto" : tag}</span>
            ))}
          </div>
        )}
        <div className="mt-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-end justify-between gap-3">
            <span className="text-xs font-bold text-slate-400">Listed Price</span>
            <span className="text-lg font-black text-white">{formatMoney(listing.listedPriceCents)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold text-slate-500">Shipping</span>
            <span className="text-xs font-bold text-slate-300">{listing.shippingPriceCents == null ? "N/A" : formatMoney(listing.shippingPriceCents)}</span>
          </div>
        </div>
        <div className="mt-auto grid grid-cols-1 gap-2 pt-3 min-[420px]:grid-cols-3">
          <a href={listing.listingUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center rounded-md border border-white/10 text-xs font-black text-white hover:bg-white/10">View Listing</a>
          <button type="button" className="flex h-11 items-center justify-center rounded-md border border-white/10 text-xs font-black text-white hover:bg-white/10">Analyze Card</button>
          <button type="button" className="flex h-11 items-center justify-center rounded-md bg-emerald-400 text-xs font-black text-[#070A12] hover:bg-emerald-300" onClick={() => onAddFlip({ player: listing.title, cardSummary: `${listing.sport} ${listing.tags.join(" ")}`.trim(), status: "Watching", purchaseDate: "", purchasePrice: listing.listedPriceCents / 100, source: listing.source, listedPrice: listing.listedPriceCents / 100, soldPrice: 0, saleDate: "", notes: `Market Gallery: ${listing.listingUrl}` })}>Track Flip</button>
        </div>
      </div>
    </article>
  );
}

function getMarketListingBadge(listing: MarketGalleryListing) {
  if (listing.tags.includes("Trending")) return { label: "Trending", tone: "bg-emerald-400 text-[#070A12]" };
  if (listing.tags.includes("Recently Listed")) return { label: "Recently Listed", tone: "bg-sky-300 text-[#070A12]" };
  if (listing.tags.includes("Graded")) return { label: "Graded", tone: "bg-amber-300 text-[#070A12]" };
  if (listing.tags.includes("Autos")) return { label: "Auto", tone: "bg-emerald-400 text-[#070A12]" };
  if (listing.tags.includes("Numbered")) return { label: "Numbered", tone: "bg-slate-200 text-[#070A12]" };
  if (listing.listedPriceCents >= 50_000) return { label: "Big Card", tone: "bg-amber-300 text-[#070A12]" };
  return { label: "Active", tone: "bg-slate-200 text-[#070A12]" };
}

function getSpotlightBadge(find: DealFind, profit: number | null) {
  if (find.flipScore >= 85 && (profit ?? 0) > 0) return { label: "Hot Deal", tone: "bg-amber-300 text-[#070A12]" };
  if (find.currentAskingPriceCents >= 50_000) return { label: "Big Card", tone: "bg-amber-300/90 text-[#070A12]" };
  if (find.flipScoreLabel === "Strong Buy") return { label: "Strong Buy", tone: "bg-emerald-400 text-[#070A12]" };
  if (find.flipScoreLabel === "Watch") return { label: "Watchlist", tone: "bg-slate-200 text-[#070A12]" };
  return { label: "Risky", tone: "bg-red-400 text-white" };
}

function ChangePill({ label, cents, empty }: { label: string; cents: number; empty?: boolean }) {
  const positive = cents >= 0;
  if (empty) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-3 py-1 text-xs font-black text-slate-400">
        {label} pending history
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${positive ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"}`}>
      {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {label} {formatMoney(Math.abs(cents))}
    </span>
  );
}

function MoverRow({ name, value, score, positive = false }: { name: string; value?: number | null; score: number; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/8 py-3 last:border-0">
      <div>
        <p className="font-bold text-white">{name}</p>
        <p className="text-xs font-semibold text-slate-400">Signal score {score}</p>
      </div>
      <p className={`font-black ${positive ? "text-emerald-300" : "text-red-300"}`}>{formatMoney(value ?? 0)}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-white/10 bg-black/20 p-3">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">{body}</p>
    </div>
  );
}

function ProBadge({ isProUser }: { isProUser: boolean }) {
  return (
    <span className={`rounded-md px-2.5 py-1 text-xs font-black ${isProUser ? "bg-emerald-300 text-[#070A12]" : "bg-amber-300 text-[#070A12]"}`}>
      {isProUser ? "PRO ACTIVE" : "PRO"}
    </span>
  );
}

function ProCallout({ isProUser, onOpenDeals }: { isProUser: boolean; onOpenDeals: () => void }) {
  const features = ["Advanced Flip Score", "Historical charts", "Deal alerts", "Market trends"];

  return (
    <div className={`rounded-md border p-4 ${isProUser ? "border-emerald-300/25 bg-emerald-300/10" : "border-amber-300/25 bg-amber-300/10"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.18em] ${isProUser ? "text-emerald-200" : "text-amber-200"}`}>
            {isProUser ? "Pro unlocked locally" : "Upgrade to Pro"}
          </p>
          <h3 className="mt-1 text-xl font-black text-white">
            {isProUser ? "Pro workspace preview is active" : "Unlock sniper-grade market intelligence"}
          </h3>
          <p className="mt-2 text-sm font-semibold text-slate-300">
            {isProUser
              ? "Development Pro mode is enabled for UI gating only. Core scan, pricing, and collection logic is unchanged."
              : "Advanced Flip Score insights, historical price charts, deal alerts, and market trends are ready for subscription gating."}
          </p>
        </div>
        <Crown className={`h-6 w-6 flex-none ${isProUser ? "text-emerald-200" : "text-amber-200"}`} aria-hidden="true" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {features.map((feature) => (
          <div key={feature} className={`rounded-md border bg-black/20 p-3 ${isProUser ? "border-emerald-300/20" : "border-amber-300/20"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-black ${isProUser ? "text-emerald-100" : "text-amber-100"}`}>{feature}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-black text-[#070A12] ${isProUser ? "bg-emerald-300" : "bg-amber-300"}`}>
                {isProUser ? "UNLOCKED" : "LOCKED"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onOpenDeals} className={`mt-4 h-11 w-full rounded-md text-sm font-black text-[#070A12] transition ${isProUser ? "bg-emerald-300 hover:bg-emerald-200" : "bg-amber-300 hover:bg-amber-200"}`}>
        {isProUser ? "Open Pro deal flow" : "Preview Pro deal flow"}
      </button>
    </div>
  );
}

function TabNav({ activeTab, onChange }: { activeTab: TabKey; onChange: (tab: TabKey) => void }) {
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "dashboard", label: "Dashboard" },
    { key: "scan", label: "Scan" },
    { key: "collection", label: "Collection" },
    { key: "deals", label: "Finds" },
    { key: "flips", label: "Flips" },
    { key: "market", label: "Market" }
  ];

  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`h-11 shrink-0 rounded-md px-4 text-sm font-black transition ${activeTab === tab.key ? "bg-emerald-400 text-[#070A12] shadow-lift" : "bg-white/8 text-slate-300 hover:bg-white/14 hover:text-white"}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function SharedSportFilterChips({ active, onChange }: { active: SharedSportFilter; onChange: (value: SharedSportFilter) => void }) {
  const filters: Array<{ value: SharedSportFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "football", label: "Football" },
    { value: "baseball", label: "Baseball" },
    { value: "basketball", label: "Basketball" }
  ];

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
      {filters.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          className={`h-10 shrink-0 rounded-full px-4 text-xs font-black transition ${active === filter.value ? "bg-emerald-400 text-[#070A12] shadow-lift" : "bg-white/8 text-slate-300 hover:bg-white/14 hover:text-white"}`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function emptyValueInsights(rationale: string): PriceEstimate["valueInsights"] {
  return {
    estimatedRawValueCents: null,
    potentialGradedValueCents: null,
    gradingSpreadCents: null,
    worthGrading: "UNKNOWN",
    rationale
  };
}

function buildActiveAskQuery(card: Partial<ScanResult>) {
  return [
    card.playerName,
    card.year,
    card.brand,
    card.setName,
    card.cardNumber ? `#${card.cardNumber}` : null,
    card.parallel,
    card.serialNumber,
    card.team,
    "sports card"
  ]
    .filter((part) => part && String(part).toLowerCase() !== reviewText.toLowerCase())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildClientPriceEstimate(comps: PriceEstimate["comps"], message: string): PriceEstimate {
  const seen = new Set<string>();
  const usable = comps
    .filter((comp) => comp.salePriceCents > 0)
    .filter((comp) => {
      const key = `${comp.title}-${comp.salePriceCents}-${comp.soldAt ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.salePriceCents - b.salePriceCents);
  if (usable.length === 0) {
    return {
      status: "NO_COMPS",
      message,
      lowEstimateCents: null,
      averageEstimateCents: null,
      highEstimateCents: null,
    confidenceScore: 0,
    comps: [],
    valueInsights: emptyValueInsights(message),
    debug: isDevelopmentMode ? {
      exactQuery: "",
      broaderQuery: message,
      rawSoldCompsReturned: comps.length,
      compsRemovedByFilters: comps.length,
      usableComps: 0,
      removedCompReasons: [],
      confidenceScore: 0,
      confidenceExplanation: "No usable broader comps were available after filtering.",
      activeListingsUsedOnlyAsMarketSentiment: true
    } : undefined
  };
  }
  const filtered = trimClientOutliers(usable);
  const average = Math.round(filtered.reduce((sum, comp) => sum + comp.salePriceCents, 0) / filtered.length);
  const recent = [...filtered].sort((a, b) => new Date(b.soldAt ?? 0).getTime() - new Date(a.soldAt ?? 0).getTime()).slice(0, 12);
  return {
    status: "FOUND",
    message,
    lowEstimateCents: filtered[0].salePriceCents,
    averageEstimateCents: average,
    highEstimateCents: filtered[filtered.length - 1].salePriceCents,
    confidenceScore: Number(Math.min(0.72, Math.max(0.16, filtered.length / 18)).toFixed(2)),
    comps: recent,
    valueInsights: {
      estimatedRawValueCents: average,
      potentialGradedValueCents: null,
      gradingSpreadCents: null,
      worthGrading: "UNKNOWN",
      rationale: "Broader matches can help frame value when exact comps are rare, but should be reviewed carefully."
    },
    debug: isDevelopmentMode ? {
      exactQuery: "",
      broaderQuery: message,
      rawSoldCompsReturned: comps.length,
      compsRemovedByFilters: comps.length - filtered.length,
      usableComps: filtered.length,
      removedCompReasons: [],
      confidenceScore: Number(Math.min(0.72, Math.max(0.16, filtered.length / 18)).toFixed(2)),
      confidenceExplanation: "Broader-match confidence is capped because these comps are not exact matches.",
      activeListingsUsedOnlyAsMarketSentiment: true
    } : undefined
  };
}

function getPricingConfidenceLabel(score: number) {
  if (score >= 0.75) return "High";
  if (score >= 0.45) return "Medium";
  return "Low";
}

function getPricingConfidenceExplanation(price: PriceEstimate) {
  const label = getPricingConfidenceLabel(price.confidenceScore);
  if (price.debug?.confidenceExplanation) return price.debug.confidenceExplanation;
  if (label === "High") return "High confidence: strong exact-ish sold comps matched key card details.";
  if (label === "Medium") return "Medium confidence: usable sold comps were found, but one or more details are imperfect.";
  return "Low confidence: fallback, weak, sparse, or wide-spread sold comps. Review before relying on this value.";
}

function trimClientOutliers(comps: PriceEstimate["comps"]) {
  if (comps.length < 5) return comps;
  const sorted = [...comps].sort((a, b) => a.salePriceCents - b.salePriceCents);
  const median = sorted[Math.floor(sorted.length / 2)].salePriceCents;
  return sorted.filter((comp) => comp.salePriceCents >= median * 0.25 && comp.salePriceCents <= median * 4);
}

function isLowNumbered(serialNumber: string) {
  const match = serialNumber.match(/(?:^|\D)\d{1,3}\s*\/\s*(\d{1,4})(?:\D|$)/);
  return Boolean(match && Number(match[1]) <= 25);
}

function getSerialParallel(serialNumber: string) {
  const match = serialNumber.match(/\/\s*(10|25|50|99|199)\b/);
  return match ? `Numbered /${match[1]}` : null;
}

function getSerialForParallelSearch(serialNumber: string, parallel: string) {
  const denominator = parallel.match(/\/(10|25|50|99|199)\b/)?.[1];
  if (!denominator) return serialNumber;
  return serialNumber.includes(`/${denominator}`) ? serialNumber : `/${denominator}`;
}

function buildParallelSearchCard(card: ScanResult, parallel: string): ScanResult {
  return {
    ...card,
    playerName: card.playerName,
    sport: card.sport,
    year: card.year,
    brand: card.brand,
    setName: card.setName,
    cardNumber: card.cardNumber,
    team: card.team,
    rookieFlag: card.rookieFlag,
    parallel,
    serialNumber: getSerialForParallelSearch(card.serialNumber, parallel)
  };
}

function getPossibleParallels(card: ScanResult) {
  const text = [card.parallel, card.serialNumber, card.conditionNotes.overall, card.gradingHelper.rationale].join(" ").toLowerCase();
  const options = [
    "Base",
    "Silver / Prizm / Refractor",
    "Gold",
    "Blue",
    "Red",
    "Green",
    "Mojo",
    "Auto",
    "Patch",
    "Numbered /10",
    "Numbered /25",
    "Numbered /50",
    "Numbered /99",
    "Numbered /199"
  ];
  const serialParallel = getSerialParallel(card.serialNumber);
  return options.map((label) => ({
    label,
    confirmed:
      (label === serialParallel) ||
      (label === "Auto" && card.autographFlag) ||
      (label === "Patch" && card.relicFlag) ||
      (label !== "Base" && text.includes(label.toLowerCase().split(" / ")[0]))
  })).sort((a, b) => Number(b.confirmed) - Number(a.confirmed));
}

function calculateManualEstimate(comps: ManualComp[]) {
  const sorted = comps
    .filter((comp) => comp.salePrice > 0)
    .sort((a, b) => a.salePrice - b.salePrice);
  if (sorted.length === 0) return { low: null, average: null, high: null, count: 0, confidence: 0 };
  const average = sorted.reduce((sum, comp) => sum + comp.salePrice, 0) / sorted.length;
  return {
    low: sorted[0].salePrice,
    average,
    high: sorted[sorted.length - 1].salePrice,
    count: sorted.length,
    confidence: Math.min(0.9, sorted.length / 8)
  };
}

function calculateManualDeal(listing: ManualActiveListing, estimate: ReturnType<typeof calculateManualEstimate>, card: ScanResult) {
  const asking = listing.askingPrice || 0;
  const average = estimate.average;
  const upside = average != null ? average - asking : null;
  const spread = average && average > 0 && upside != null ? upside / average : 0;
  const score = Math.round(
    Math.min(
      100,
      Math.max(0, spread * 45 + estimate.confidence * 25 + (card.rookieFlag ? 10 : 0) + (card.parallel ? 10 : 0) + Math.min(10, estimate.count))
    )
  );
  const label = score >= 80 ? "Strong Buy" : score >= 60 ? "Watch" : score >= 40 ? "Risky" : "Avoid";
  return { asking, average, upside, score, label };
}

function centsToCsvDollars(cents?: number | null) {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null>>) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function DetectedSummary({ card }: { card: ScanResult }) {
  return (
    <div className="mb-4 rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-emerald-400 px-2 py-1 text-xs font-black text-[#070A12]">AI draft</span>
            <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-black text-slate-200">Your edits override AI</span>
          </div>
          <h2 className="mt-3 text-xl font-black text-white">{card.playerName || reviewText}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            {[card.year, card.brand, card.setName, card.cardNumber ? `#${card.cardNumber}` : null, card.parallel].filter(Boolean).join(" - ") || reviewText}
          </p>
        </div>
        <SportBadge sport={card.sport} />
      </div>
      {card.uncertainFields.length > 0 && (
        <p className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/10 p-2 text-xs font-bold text-amber-200">
          Review needed: {card.uncertainFields.join(", ")}
        </p>
      )}
    </div>
  );
}

function ConfidenceIndicator({ score }: { score: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  const label = pct >= 80 ? "High" : pct >= 55 ? "Medium" : "Low";

  return (
    <div className="min-w-24">
      <div className="flex items-center justify-between gap-2 text-xs font-black">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-white/10">
        <div className={`h-2 rounded-full ${pct >= 80 ? "bg-emerald-400" : pct >= 55 ? "bg-amber-300" : "bg-flame"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  uncertain
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  uncertain?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-bold text-slate-400">
        {label}
        {uncertain && <span className="text-flame">Needs review</span>}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 h-12 w-full rounded-md border bg-black/30 px-3 text-base font-semibold text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/60 sm:text-sm ${uncertain ? "border-flame/70 ring-2 ring-flame/10" : "border-white/10"}`}
      />
    </label>
  );
}

function SelectField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-400">Sport</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-12 w-full rounded-md border border-white/10 bg-black/30 px-3 text-base font-semibold text-white sm:text-sm">
        {sportOptions.map((sport) => (
          <option key={sport.value} value={sport.value}>
            {sport.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`h-12 rounded-md border text-sm font-black ${active ? "border-emerald-300 bg-emerald-400 text-[#070A12]" : "border-white/10 bg-white/8 text-slate-300 hover:bg-white/14"}`}>
      {label}
    </button>
  );
}

function PossibleParallelsPanel({ card, loading, selectedParallel, onSearch }: { card: ScanResult; loading: boolean; selectedParallel: string; onSearch: (parallel: string) => void }) {
  const parallels = getPossibleParallels(card);
  return (
    <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white">Possible Parallel Matches</h3>
          <p className="mt-1 text-xs font-semibold text-slate-400">Shown as possible matches unless confirmed from card text.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {parallels.map((parallel) => {
          const selected = selectedParallel === parallel.label;
          return (
          <div key={parallel.label} className={`flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between ${selected ? "border-emerald-300/60 bg-emerald-300/10" : "border-white/10 bg-white/[0.04]"}`}>
            <div>
              <p className="text-sm font-black text-white">{parallel.label}</p>
              <p className={`text-[11px] font-bold ${selected ? "text-emerald-200" : parallel.confirmed ? "text-emerald-300" : "text-slate-500"}`}>{selected ? "Selected for comp search" : parallel.confirmed ? "Detected from scan" : "Possible match"}</p>
            </div>
            <button type="button" disabled={loading} onClick={() => onSearch(parallel.label)} className="h-11 w-full rounded-md bg-white/8 px-3 text-xs font-black text-slate-100 hover:bg-white/14 disabled:opacity-60 sm:w-auto">
              {loading && selected ? "Searching" : selected ? "Use this parallel" : "Search comps for this match"}
            </button>
          </div>
        )})}
      </div>
    </div>
  );
}

function PricingPanel({
  price,
  broaderPrice,
  broaderMessage,
  activeAsks,
  activeAsksLoading,
  loading,
  broaderLoading,
  demoMode,
  contextMessage,
  onSearchBroader
}: {
  price: PriceEstimate | null;
  broaderPrice: PriceEstimate | null;
  broaderMessage: string;
  activeAsks: ActiveAskingListing[];
  activeAsksLoading: boolean;
  loading: boolean;
  broaderLoading: boolean;
  demoMode: boolean;
  contextMessage: string;
  onSearchBroader: () => void;
}) {
  const emptyMessage = price?.message || (price?.status === "NOT_CONNECTED" ? "Live pricing not connected yet." : "No reliable sold comps found for this exact match. Try broadening the search.");
  const insights = price?.valueInsights ?? emptyValueInsights(emptyMessage);
  const confidenceLabel = price ? getPricingConfidenceLabel(price.confidenceScore) : "Low";

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-4 shadow-lift sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BadgeDollarSign className="h-5 w-5 text-flame" aria-hidden="true" />
          <h2 className="text-lg font-black">Sold comps</h2>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-xs font-black text-emerald-300">{providerSourceLabels.ebaySoldComps}</span>
        <span className="rounded-md bg-white/8 px-2 py-1 text-xs font-black text-slate-300">Completed sales</span>
      </div>
      <p className="mt-2 rounded-md border border-white/10 bg-black/20 p-2 text-xs font-semibold text-slate-300">
        Sold comps are completed sales. Active listings show asking prices and may not reflect actual value.
      </p>
      {demoMode && <p className="mt-3 rounded-md bg-flame/10 p-2 text-xs font-black text-flame">Demo/Test Pricing mode is on. Demo values are labeled and kept separate from live comps.</p>}
      {(loading || contextMessage) && <p className="mt-3 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-black text-emerald-100">{loading ? contextMessage || "Finding sold comps..." : contextMessage}</p>}
      {!price ? (
        <p className="mt-3 text-sm text-slate-400">Scan or review a card to pull live sold-listing comps.</p>
      ) : price.status !== "FOUND" ? (
        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
          <p className="text-sm font-bold text-slate-300">{price.message || (price.status === "NO_COMPS" ? "No reliable sold comps found for this exact match. Try broadening the search." : emptyMessage)}</p>
          <button type="button" onClick={onSearchBroader} disabled={broaderLoading} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 text-sm font-black text-[#070A12] disabled:opacity-60 sm:w-auto">
            {broaderLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            Search Broader Comps
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-xs font-black text-emerald-300">{providerSourceLabels.ebaySoldComps}</span>
            <span className="rounded-md bg-white/8 px-2 py-1 text-xs font-black text-slate-300">Sold listings only</span>
            <span className="rounded-md bg-white/8 px-2 py-1 text-xs font-black text-slate-300">{confidenceLabel} confidence · {Math.round(price.confidenceScore * 100)}%</span>
            {price.message?.startsWith("Parallel comp search:") && <span className="rounded-md bg-amber-300/15 px-2 py-1 text-xs font-black text-amber-200">{price.message}</span>}
          </div>
          <p className="mt-2 rounded-md border border-white/10 bg-black/20 p-2 text-xs font-semibold text-slate-300">{getPricingConfidenceExplanation(price)}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Metric label="Low sold comp" value={formatMoney(price.lowEstimateCents)} />
            <Metric label="Average sold comp" value={formatMoney(price.averageEstimateCents)} />
            <Metric label="High sold comp" value={formatMoney(price.highEstimateCents)} />
          </div>
          <ValueInsightsPanel insights={insights} />
          <div className="mt-3 space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Last 5 sold comps</p>
            {price.comps.slice(0, 5).map((comp, index) => (
              <a key={`${comp.title}-${index}`} href={comp.listingUrl ?? "#"} target="_blank" rel="noreferrer" className="block rounded-md border border-white/10 bg-black/20 p-3 hover:border-emerald-300/40">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <p className="line-clamp-2 text-sm font-bold">{comp.title}</p>
                  <span className="text-sm font-black">{formatMoney(comp.salePriceCents)}</span>
                </div>
                {comp.isDemo && <p className="mt-2 rounded-md bg-flame/10 p-2 text-xs font-black text-flame">Demo/Test Pricing</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {comp.isDemo ? "Demo/Test Pricing" : comp.source || providerSourceLabels.ebaySoldComps}
                  {" - completed sale"}
                  {" - "}{comp.saleType ?? "UNKNOWN"} - {comp.condition ?? "condition not listed"}
                  {comp.soldAt ? ` - ${new Date(comp.soldAt).toLocaleDateString()}` : ""}
                </p>
                {comp.matchNotes && comp.matchNotes.length > 0 && (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-300/80">Matched: {comp.matchNotes.slice(0, 4).join(", ")}</p>
                )}
              </a>
            ))}
          </div>
          <button type="button" onClick={onSearchBroader} disabled={broaderLoading} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/8 text-sm font-black text-white hover:bg-white/14 disabled:opacity-60">
            {broaderLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            Search Broader Comps
          </button>
        </>
      )}
      {broaderPrice && (
        <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black text-amber-100">Broader Matches</h3>
                <span className="rounded-md bg-amber-300/15 px-2 py-1 text-[11px] font-black text-amber-100">Fallback Estimate</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-amber-100/75">{broaderMessage || broaderPrice.message}. These are broader sold-comp matches, not exact card matches.</p>
            </div>
          </div>
          {broaderPrice.status === "FOUND" ? (
            <>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Metric label="Low" value={formatMoney(broaderPrice.lowEstimateCents)} />
                <Metric label="Average" value={formatMoney(broaderPrice.averageEstimateCents)} />
                <Metric label="High" value={formatMoney(broaderPrice.highEstimateCents)} />
              </div>
              <div className="mt-3 space-y-2">
                {broaderPrice.comps.slice(0, 5).map((comp, index) => (
                  <a key={`broad-${comp.title}-${index}`} href={comp.listingUrl ?? "#"} target="_blank" rel="noreferrer" className="block rounded-md border border-white/10 bg-black/20 p-3 hover:border-amber-300/40">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <p className="line-clamp-2 text-sm font-bold text-white">{comp.title}</p>
                      <span className="text-sm font-black text-white">{formatMoney(comp.salePriceCents)}</span>
                    </div>
                    <p className="mt-1 text-xs text-amber-100/70">
                      {comp.isDemo ? "Demo/Test Pricing" : comp.source || providerSourceLabels.ebaySoldComps} - Fallback Estimate - completed sale{comp.soldAt ? ` - ${new Date(comp.soldAt).toLocaleDateString()}` : ""}
                    </p>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm font-bold text-amber-100/80">No broader sold comps found.</p>
          )}
        </div>
      )}
      <ActiveListingsPanel listings={activeAsks} loading={activeAsksLoading} />
      {isDevelopmentMode && <PricingDebugPanel price={price} broaderPrice={broaderPrice} activeAsksLoaded={activeAsks.length > 0 || activeAsksLoading} />}
    </div>
  );
}

function PricingDebugPanel({ price, broaderPrice, activeAsksLoaded }: { price: PriceEstimate | null; broaderPrice: PriceEstimate | null; activeAsksLoaded: boolean }) {
  const debug = price?.debug;
  const broaderDebug = broaderPrice?.debug;
  if (!debug && !broaderDebug) return null;
  const removedReasons = debug?.removedCompReasons?.slice(0, 5) ?? [];

  return (
    <div className="mt-4 rounded-md border border-sky-300/20 bg-sky-300/10 p-3">
      <div className="flex items-center gap-2">
        <CircleAlert className="h-4 w-4 text-sky-200" aria-hidden="true" />
        <h3 className="text-sm font-black text-sky-100">Pricing Debug</h3>
      </div>
      <div className="mt-3 grid gap-2 text-xs font-semibold text-sky-50/80 sm:grid-cols-2">
        <DebugRow label="Exact query used" value={debug?.exactQuery || "N/A"} />
        <DebugRow label="Broader query used" value={broaderDebug?.broaderQuery || broaderDebug?.exactQuery || "Not run"} />
        <DebugRow label="Raw sold comps returned" value={debug?.rawSoldCompsReturned ?? 0} />
        <DebugRow label="Comps removed by filters" value={debug?.compsRemovedByFilters ?? 0} />
        <DebugRow label="Usable comps" value={debug?.usableComps ?? 0} />
        <DebugRow label="Confidence score" value={`${Math.round((debug?.confidenceScore ?? 0) * 100)}%`} />
        <DebugRow label="Confidence explanation" value={debug?.confidenceExplanation || "N/A"} />
        <DebugRow label="Active listing usage" value={(debug?.activeListingsUsedOnlyAsMarketSentiment ?? activeAsksLoaded) ? "Market sentiment only" : "Not used"} />
      </div>
      <div className="mt-3 rounded-md border border-sky-300/15 bg-black/20 p-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-200">Top removed comp reasons</p>
        {removedReasons.length === 0 ? (
          <p className="mt-2 text-xs font-semibold text-sky-50/70">No removed comp reasons reported.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {removedReasons.map((item, index) => (
              <div key={`${item.title}-${index}`}>
                <p className="line-clamp-1 text-xs font-bold text-white">{item.title}</p>
                <p className="text-[11px] font-semibold text-sky-100/70">{item.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DebugRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-sky-300/15 bg-black/20 p-2">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-sky-200">{label}</p>
      <p className="mt-1 break-words text-xs text-sky-50/80">{value}</p>
    </div>
  );
}

function ActiveListingsPanel({ listings, loading }: { listings: ActiveAskingListing[]; loading: boolean }) {
  return (
    <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white">Current Active Listings</h3>
          <p className="mt-1 text-xs font-semibold text-slate-400">{providerSourceLabels.ebayActiveListings}. Market sentiment only. Active listings are asking prices, not sold comps or appraised value.</p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
      </div>
      {loading && listings.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-slate-400">Searching market listings...</p>
      ) : listings.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-slate-400">No active listings found for this card yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {listings.map((listing) => (
            <a key={listing.id} href={listing.listingUrl} target="_blank" rel="noreferrer" className="block rounded-md border border-white/10 bg-white/[0.04] p-3 hover:border-emerald-300/40">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <p className="line-clamp-2 text-sm font-bold text-white">{listing.title}</p>
                <span className="text-sm font-black text-white">{formatMoney(listing.listedPriceCents)}</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {listing.isDemo ? "Demo/Test Data" : listing.source} - active asking price only{listing.shippingPriceCents == null ? "" : ` - shipping ${formatMoney(listing.shippingPriceCents)}`}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ValueInsightsPanel({ insights }: { insights: PriceEstimate["valueInsights"] }) {
  return (
    <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-cobalt" aria-hidden="true" />
        <h3 className="text-sm font-black">Value insights</h3>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Metric label="Raw value" value={formatMoney(insights.estimatedRawValueCents)} />
        <Metric label="Graded value" value={formatMoney(insights.potentialGradedValueCents)} />
        <Metric label="Worth grading" value={insights.worthGrading} />
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-400">{insights.rationale}</p>
    </div>
  );
}

function ManualCompsPanel({
  comps,
  estimate,
  onAdd,
  onRemove
}: {
  comps: ManualComp[];
  estimate: ReturnType<typeof calculateManualEstimate>;
  onAdd: (comp: Omit<ManualComp, "id">) => void;
  onRemove: (id: string) => void;
}) {
  const [salePrice, setSalePrice] = useState("");
  const [soldAt, setSoldAt] = useState("");
  const [source, setSource] = useState("");
  const [saleType, setSaleType] = useState<ManualComp["saleType"]>("RAW");
  const [notes, setNotes] = useState("");

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3 shadow-lift">
      <div className="flex items-center gap-2">
        <BadgeDollarSign className="h-5 w-5 text-flame" aria-hidden="true" />
        <h2 className="text-lg font-black">Manual sold comps</h2>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-md bg-amber-300/15 px-2 py-1 text-xs font-black text-amber-200">Fallback Estimate</span>
        <span className="rounded-md bg-white/8 px-2 py-1 text-xs font-black text-slate-300">Manual Sold Comps</span>
      </div>
      <p className="mt-2 text-sm text-slate-400">Add manual completed-sale comps while waiting for live pricing. These are separate from eBay sold comps and depend on the sources you enter.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Low" value={estimate.low == null ? "N/A" : formatMoney(Math.round(estimate.low * 100))} />
        <Metric label="Average" value={estimate.average == null ? "N/A" : formatMoney(Math.round(estimate.average * 100))} />
        <Metric label="High" value={estimate.high == null ? "N/A" : formatMoney(Math.round(estimate.high * 100))} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Sale price" value={salePrice} onChange={setSalePrice} placeholder="0.00" />
        <Field label="Date sold" value={soldAt} onChange={setSoldAt} placeholder="YYYY-MM-DD" />
        <Field label="Source" value={source} onChange={setSource} placeholder="eBay, show, auction..." />
        <label className="block">
          <span className="text-xs font-bold text-slate-400">Raw/graded</span>
          <select value={saleType} onChange={(event) => setSaleType(event.target.value as ManualComp["saleType"])} className="mt-1 h-11 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white">
            <option value="RAW">Raw</option>
            <option value="GRADED">Graded</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </label>
      </div>
      <div className="mt-3">
        <Field label="Notes" value={notes} onChange={setNotes} placeholder="Sale details, grade, condition..." />
      </div>
      <button
        type="button"
        className="mt-3 h-10 w-full rounded-md bg-ink text-sm font-black text-white"
        onClick={() => {
          if (!Number(salePrice)) return;
          onAdd({ salePrice: Number(salePrice), soldAt, source: source || "Manual", saleType, notes });
          setSalePrice("");
          setSoldAt("");
          setSource("");
          setNotes("");
        }}
      >
        Add manual comp
      </button>
      <div className="mt-3 space-y-2">
        {comps.length === 0 ? (
          <p className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-slate-400">No manual comps yet.</p>
        ) : (
          comps.map((comp) => (
            <div key={comp.id} className="rounded-md border border-white/10 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{formatMoney(Math.round(comp.salePrice * 100))}</p>
                  <p className="text-xs font-semibold text-slate-400">Manual Sold Comp - {comp.source} - {comp.saleType} - {comp.soldAt || "date not set"}</p>
                  {comp.notes && <p className="mt-1 text-xs text-slate-400">{comp.notes}</p>}
                </div>
                <button type="button" onClick={() => onRemove(comp.id)} className="text-xs font-black text-flame">Remove</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ManualListingPanel({
  listing,
  onChange,
  deal,
  onAddFlip
}: {
  listing: ManualActiveListing;
  onChange: (listing: ManualActiveListing) => void;
  deal: ReturnType<typeof calculateManualDeal>;
  onAddFlip: (record: Omit<FlipRecord, "id">) => void;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3 shadow-lift">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-cobalt" aria-hidden="true" />
        <h2 className="text-lg font-black">Manual active listing</h2>
      </div>
      <p className="mt-2 text-sm text-slate-400">Paste a listing URL and asking price. This is active listing data, not a sold comp.</p>
      <div className="mt-3 grid gap-3">
        <Field label="Listing URL" value={listing.url} onChange={(url) => onChange({ ...listing, url })} placeholder="https://..." />
        <Field label="Asking price" value={listing.askingPrice ? String(listing.askingPrice) : ""} onChange={(value) => onChange({ ...listing, askingPrice: Number(value) || 0 })} placeholder="0.00" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Manual avg" value={deal.average == null ? "N/A" : formatMoney(Math.round(deal.average * 100))} />
        <Metric label="Upside" value={deal.upside == null ? "N/A" : formatMoney(Math.round(deal.upside * 100))} />
        <Metric label="Flip Score" value={`${deal.score} ${deal.label}`} />
        <Metric label="Ask" value={formatMoney(Math.round(deal.asking * 100))} />
      </div>
      <button
        type="button"
        className="mt-3 h-10 w-full rounded-md bg-flame text-sm font-black text-white"
        onClick={() => onAddFlip({
          player: "Manual listing",
          cardSummary: listing.url,
          status: "Watching",
          purchaseDate: "",
          purchasePrice: listing.askingPrice,
          source: "Manual active listing",
          listedPrice: deal.average ?? 0,
          soldPrice: 0,
          saleDate: "",
          notes: `Manual Flip Score: ${deal.score} ${deal.label}`
        })}
      >
        Track manual listing
      </button>
    </div>
  );
}

function calculateProfit(input: {
  purchasePrice: number;
  shippingCost: number;
  gradingCost: number;
  sellingFeePct: number;
  targetSellingPrice: number;
}) {
  const totalCost = input.purchasePrice + input.shippingCost + input.gradingCost;
  const fee = input.targetSellingPrice * (input.sellingFeePct / 100);
  const profit = input.targetSellingPrice - fee - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  const breakEven = input.sellingFeePct >= 100 ? totalCost : totalCost / (1 - input.sellingFeePct / 100);
  const label = profit >= totalCost * 0.2 ? "Profitable" : profit > 0 ? "Thin Margin" : "Not Worth It";
  return { totalCost, profit, roi, breakEven, label };
}

function ProfitEstimator({
  title,
  defaultPurchasePrice,
  defaultTargetPrice,
  onAddFlip
}: {
  title: string;
  defaultPurchasePrice?: string;
  defaultTargetPrice?: string;
  onAddFlip: (record: Omit<FlipRecord, "id" | "player" | "cardSummary">) => void;
}) {
  const [purchasePrice, setPurchasePrice] = useState(defaultPurchasePrice ?? "");
  const [shippingCost, setShippingCost] = useState("5");
  const [gradingCost, setGradingCost] = useState("0");
  const [sellingFeePct, setSellingFeePct] = useState("13.25");
  const [targetSellingPrice, setTargetSellingPrice] = useState(defaultTargetPrice ?? "");
  const result = calculateProfit({
    purchasePrice: Number(purchasePrice) || 0,
    shippingCost: Number(shippingCost) || 0,
    gradingCost: Number(gradingCost) || 0,
    sellingFeePct: Number(sellingFeePct) || 0,
    targetSellingPrice: Number(targetSellingPrice) || 0
  });

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3 shadow-lift">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-cobalt" aria-hidden="true" />
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Purchase" value={purchasePrice} onChange={setPurchasePrice} placeholder="0.00" />
        <Field label="Shipping" value={shippingCost} onChange={setShippingCost} placeholder="0.00" />
        <Field label="Grading" value={gradingCost} onChange={setGradingCost} placeholder="0.00" />
        <Field label="Fee %" value={sellingFeePct} onChange={setSellingFeePct} placeholder="13.25" />
        <Field label="Target sale" value={targetSellingPrice} onChange={setTargetSellingPrice} placeholder="0.00" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Total cost" value={formatMoney(Math.round(result.totalCost * 100))} />
        <Metric label="Profit" value={formatMoney(Math.round(result.profit * 100))} />
        <Metric label="ROI" value={`${result.roi.toFixed(1)}%`} />
        <Metric label="Break-even" value={formatMoney(Math.round(result.breakEven * 100))} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 p-3">
        <span className="text-sm font-black">{result.label}</span>
        <button
          type="button"
          onClick={() => onAddFlip({
            status: "Watching",
            purchaseDate: "",
            purchasePrice: Number(purchasePrice) || 0,
            source: "",
            listedPrice: Number(targetSellingPrice) || 0,
            soldPrice: 0,
            saleDate: "",
            notes: `Profit check: ${result.label}`
          })}
          className="rounded-md bg-ink px-3 py-2 text-xs font-black text-white"
        >
          Track flip
        </button>
      </div>
    </div>
  );
}

function CollectionPanel({
  collection,
  activeSportFilter,
  search,
  setSearch,
  onAddFlip,
  onExport
}: {
  collection: CollectionResponse | null;
  activeSportFilter: SharedSportFilter;
  search: string;
  setSearch: (value: string) => void;
  onAddFlip: (record: Omit<FlipRecord, "id">) => void;
  onExport: () => void;
}) {
  const mostValuable = collection?.summary.highestValueCards?.[0] ?? null;
  const recentAdds = collection?.summary.recentlyAddedCards ?? [];

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3 shadow-lift">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-cobalt" aria-hidden="true" />
        <h2 className="text-lg font-black">Collection power</h2>
      </div>
      <button type="button" onClick={onExport} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/8 text-sm font-black text-white transition hover:bg-white/14">
        <Download className="h-4 w-4" aria-hidden="true" />
        Export collection CSV
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Total value" value={formatMoney(collection?.summary.totalValueCents ?? 0)} />
        <Metric label="Most valuable" value={mostValuable ? formatValueOrPending(mostValuable.estimatedValueCents) : "N/A"} />
      </div>
      {mostValuable && (
        <div className="mt-2 rounded-md border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-bold uppercase text-slate-500">Top card</p>
          <p className="mt-1 font-black">{mostValuable.card.playerName}</p>
          <p className="text-xs font-semibold text-slate-400">
            {[mostValuable.card.year, mostValuable.card.brand, mostValuable.card.setName, mostValuable.card.parallel].filter(Boolean).join(" - ")}
          </p>
        </div>
      )}
      <p className="mt-2 text-xs font-semibold text-slate-400">Showing {sharedSportFilterLabel(activeSportFilter)} from the shared sport filter.</p>
      <div className="mt-3 flex gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player, team, brand" className="h-11 w-full rounded-md border border-white/10 bg-black/30 pl-9 pr-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500" />
        </label>
      </div>
      <div className="mt-3 space-y-2">
        {(collection?.items ?? []).length === 0 ? (
          <p className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-slate-400">{sharedSportEmptyMessage(activeSportFilter, "No cards saved yet.")}</p>
        ) : (
          collection?.items.map((item) => (
            <article key={item.id} className="rounded-md border border-white/10 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{item.card.playerName}</p>
                  <p className="text-xs font-semibold text-slate-400">{[item.card.year, item.card.brand, item.card.setName, item.card.parallel].filter(Boolean).join(" - ")}</p>
                </div>
                <p className="text-sm font-black">{formatValueOrPending(item.estimatedValueCents)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <SportBadge sport={item.card.sport} />
                <span className="text-xs font-bold uppercase text-slate-500">{item.status}</span>
              </div>
              <div className="mt-3">
                <ProfitEstimator
                  title="Flip math"
                  defaultPurchasePrice={item.purchasePriceCents ? (item.purchasePriceCents / 100).toFixed(2) : ""}
                  defaultTargetPrice={item.estimatedValueCents ? (item.estimatedValueCents / 100).toFixed(2) : ""}
                  onAddFlip={(record) => onAddFlip({
                    ...record,
                    player: item.card.playerName,
                    cardSummary: [item.card.year, item.card.brand, item.card.setName, item.card.parallel].filter(Boolean).join(" - ")
                  })}
                />
              </div>
            </article>
          ))
        )}
      </div>
      {recentAdds.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Recent adds</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentAdds.slice(0, 5).map((item) => (
              <div key={`recent-${item.id}`} className="min-w-44 rounded-md border border-white/10 bg-black/20 p-3">
                <p className="truncate text-sm font-black">{item.card.playerName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">{formatValueOrPending(item.estimatedValueCents)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UndervaluedFindsPanel({
  finds,
  message,
  loading,
  sort,
  activeSportFilter,
  onSort,
  onRefresh,
  onAddFlip
}: {
  finds: DealFind[];
  message: string;
  loading: boolean;
  sort: DealSort;
  activeSportFilter: SharedSportFilter;
  onSort: (sort: DealSort) => void;
  onRefresh: () => void;
  onAddFlip: (record: Omit<FlipRecord, "id">) => void;
}) {
  const filteredFinds = finds.filter((find) => dealMatchesSharedSport(find, activeSportFilter));
  const sortedFinds = [...filteredFinds].sort((a, b) => {
    const profitA = a.estimatedUpsideCents ?? 0;
    const profitB = b.estimatedUpsideCents ?? 0;
    const roiA = a.currentAskingPriceCents > 0 ? profitA / a.currentAskingPriceCents : 0;
    const roiB = b.currentAskingPriceCents > 0 ? profitB / b.currentAskingPriceCents : 0;
    if (sort === "profit") return profitB - profitA;
    if (sort === "roi") return roiB - roiA;
    return b.flipScore - a.flipScore;
  });

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3 shadow-lift">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          <h2 className="text-lg font-black text-white">Undervalued Finds</h2>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="rounded-md bg-emerald-400 px-3 py-2 text-xs font-black text-[#070A12] transition hover:bg-emerald-300">
          {loading ? "Checking" : "Refresh"}
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-400">{providerSourceLabels.ebayActiveListings} are compared against {providerSourceLabels.ebaySoldComps}. Active asking prices are market sentiment only and are never treated as completed sales.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["flipScore", "Flip Score"],
          ["roi", "ROI %"],
          ["profit", "Profit $"]
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onSort(key as DealSort)}
            className={`h-10 rounded-md text-xs font-black transition ${sort === key ? "bg-emerald-400 text-[#070A12]" : "bg-white/8 text-slate-300 hover:bg-white/14"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {filteredFinds.length === 0 ? (
        <p className="mt-3 rounded-md bg-black/20 p-3 text-sm font-bold text-slate-300">{sharedSportEmptyMessage(activeSportFilter, message || "Live deal finder not connected yet.")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {sortedFinds.map((find) => {
            const profit = find.estimatedUpsideCents ?? 0;
            const roi = find.currentAskingPriceCents > 0 ? profit / find.currentAskingPriceCents : 0;
            const hot = find.flipScore >= 80 && profit > 0;
            const risky = find.flipScore < 60 || roi < 0.1;
            return (
            <article key={find.listingUrl} className="rounded-md border border-white/10 bg-black/20 p-3 transition hover:border-emerald-300/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {hot && <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-xs font-black text-emerald-300">Hot Deal</span>}
                    {risky && <span className="rounded-md bg-amber-300/15 px-2 py-1 text-xs font-black text-amber-200">Risky</span>}
                    <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-black text-white">{find.dealLabel}</span>
                    <span className="rounded-md bg-emerald-400 px-2 py-1 text-xs font-black text-[#070A12]">{find.flipScore} {find.flipScoreLabel}</span>
                  </div>
                  <h3 className="mt-2 font-black text-white">{find.player}</h3>
                  <p className="text-xs font-semibold text-slate-400">
                    {[find.year, find.brandSet, find.cardNumber ? `#${find.cardNumber}` : null].filter(Boolean).join(" - ")}
                  </p>
                </div>
                <SportBadge sport={find.sport} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <DarkMetric label="Active ask" value={formatMoney(find.currentAskingPriceCents)} />
                <DarkMetric label="Sold comp avg" value={formatMoney(find.averageSoldPriceCents)} />
                <DarkMetric label="Profit" value={formatMoney(find.estimatedUpsideCents)} tone={profit >= 0 ? "gain" : "loss"} />
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-400">
                Active asking price vs sold-comp average: {formatMoney(find.currentAskingPriceCents)} / {formatMoney(find.averageSoldPriceCents)} - ROI {(roi * 100).toFixed(1)}%
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {find.marketplaceSource} active listing - confidence {Math.round(find.confidenceScore * 100)}% - {find.soldCompCount} {providerSourceLabels.ebaySoldComps}
              </p>
              <div className="mt-3 flex gap-2">
                <a href={find.listingUrl} target="_blank" rel="noreferrer" className="flex h-10 flex-1 items-center justify-center rounded-md border border-white/10 text-sm font-black text-white transition hover:bg-white/10">
                  View listing
                </a>
                <button
                  type="button"
                  className="flex h-10 flex-1 items-center justify-center rounded-md bg-emerald-400 text-sm font-black text-[#070A12] transition hover:bg-emerald-300"
                  onClick={() => onAddFlip({
                    player: find.player,
                    cardSummary: [find.year, find.brandSet, find.cardNumber ? `#${find.cardNumber}` : null].filter(Boolean).join(" - "),
                    status: "Watching",
                    purchaseDate: "",
                    purchasePrice: find.currentAskingPriceCents / 100,
                    source: find.marketplaceSource,
                    listedPrice: find.averageSoldPriceCents ? find.averageSoldPriceCents / 100 : 0,
                    soldPrice: 0,
                    saleDate: "",
                    notes: `${find.dealLabel}. ${find.listingUrl}`
                  })}
                >
                  Track
                </button>
              </div>
            </article>
          )})}
        </div>
      )}
    </div>
  );
}

function FlipTrackerPanel({
  flips,
  activeSportFilter,
  onUpdate,
  onAdd,
  onExport
}: {
  flips: FlipRecord[];
  activeSportFilter: SharedSportFilter;
  onUpdate: (id: string, patch: Partial<FlipRecord>) => void;
  onAdd: (record: Omit<FlipRecord, "id">) => void;
  onExport: () => void;
}) {
  const filteredFlips = flips.filter((flip) => flipMatchesSharedSport(flip, activeSportFilter));
  const active = filteredFlips.filter((flip) => !["Sold", "Passed"].includes(flip.status));
  const sold = filteredFlips.filter((flip) => flip.status === "Sold");
  const totalInvested = filteredFlips.reduce((sum, flip) => sum + flip.purchasePrice, 0);
  const projectedValue = filteredFlips.reduce((sum, flip) => sum + (flip.listedPrice || flip.soldPrice), 0);
  const realizedProfit = sold.reduce((sum, flip) => sum + flip.soldPrice - flip.purchasePrice, 0);
  const sortedSold = [...sold].sort((a, b) => b.soldPrice - b.purchasePrice - (a.soldPrice - a.purchasePrice));
  const best = sortedSold[0];
  const worst = sortedSold[sortedSold.length - 1];

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3 shadow-lift">
      <div className="flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-cobalt" aria-hidden="true" />
        <h2 className="text-lg font-black">Flip Tracker</h2>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Invested" value={formatMoney(Math.round(totalInvested * 100))} />
        <Metric label="Projected" value={formatMoney(Math.round(projectedValue * 100))} />
        <Metric label="Realized" value={formatMoney(Math.round(realizedProfit * 100))} />
        <Metric label="Active flips" value={active.length} />
        <Metric label="Sold flips" value={sold.length} />
        <Metric label="Best flip" value={best ? formatMoney(Math.round((best.soldPrice - best.purchasePrice) * 100)) : "N/A"} />
        <Metric label="Worst flip" value={worst ? formatMoney(Math.round((worst.soldPrice - worst.purchasePrice) * 100)) : "N/A"} />
      </div>
      <button
        type="button"
        onClick={() => onAdd({
          player: "New flip",
          cardSummary: "",
          status: "Watching",
          purchaseDate: "",
          purchasePrice: 0,
          source: "",
          listedPrice: 0,
          soldPrice: 0,
          saleDate: "",
          notes: ""
        })}
        className="mt-3 h-10 w-full rounded-md bg-ink text-sm font-black text-white"
      >
        Add flip
      </button>
      <button
        type="button"
        onClick={onExport}
        className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/8 text-sm font-black text-white transition hover:bg-white/14"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export flips CSV
      </button>
      <div className="mt-3 space-y-3">
        {filteredFlips.length === 0 ? (
          <p className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-slate-400">{sharedSportEmptyMessage(activeSportFilter, "No flips tracked yet.")}</p>
        ) : (
          filteredFlips.map((flip) => (
            <article key={flip.id} className="rounded-md border border-white/10 bg-black/20 p-3">
              <Field label="Player" value={flip.player} onChange={(value) => onUpdate(flip.id, { player: value })} />
              <Field label="Card" value={flip.cardSummary} onChange={(value) => onUpdate(flip.id, { cardSummary: value })} />
              <label className="mt-3 block">
                <span className="text-xs font-bold text-slate-400">Status</span>
                <select value={flip.status} onChange={(event) => onUpdate(flip.id, { status: event.target.value as FlipRecord["status"] })} className="mt-1 h-11 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white">
                  {["Watching", "Bought", "Sent to Grade", "Listed", "Sold", "Passed"].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Purchase date" value={flip.purchaseDate} onChange={(value) => onUpdate(flip.id, { purchaseDate: value })} placeholder="YYYY-MM-DD" />
                <Field label="Purchase price" value={String(flip.purchasePrice || "")} onChange={(value) => onUpdate(flip.id, { purchasePrice: Number(value) || 0 })} />
                <Field label="Source" value={flip.source} onChange={(value) => onUpdate(flip.id, { source: value })} />
                <Field label="Listed price" value={String(flip.listedPrice || "")} onChange={(value) => onUpdate(flip.id, { listedPrice: Number(value) || 0 })} />
                <Field label="Sold price" value={String(flip.soldPrice || "")} onChange={(value) => onUpdate(flip.id, { soldPrice: Number(value) || 0 })} />
                <Field label="Sale date" value={flip.saleDate} onChange={(value) => onUpdate(flip.id, { saleDate: value })} placeholder="YYYY-MM-DD" />
              </div>
              <div className="mt-3">
                <Field label="Notes" value={flip.notes} onChange={(value) => onUpdate(flip.id, { notes: value })} />
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function SpotlightPanel() {
  return (
    <div className="rounded-md bg-ink p-3 text-white shadow-lift">
      <div className="flex items-center gap-2">
        <LineChart className="h-5 w-5 text-mint" aria-hidden="true" />
        <h2 className="text-lg font-black">Market spotlights</h2>
      </div>
      <p className="mt-2 text-sm text-white/70">
        External listing feed module is ready for active marketplace providers. It will only show underpriced deals,
        rookie watch cards, ending auctions, and raw-to-grade opportunities when confidence is high.
      </p>
      <div className="mt-3 rounded-md border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black">No reliable live opportunities yet</p>
            <p className="mt-1 text-xs text-white/55">Connect active listing APIs before featuring cards.</p>
          </div>
          <BookmarkPlus className="h-5 w-5 text-mint" aria-hidden="true" />
        </div>
      </div>
      <button type="button" className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 text-sm font-black text-[#070A12] transition hover:bg-emerald-300">
        Watchlist ready
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
