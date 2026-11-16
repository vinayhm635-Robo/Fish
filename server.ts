import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  calculateFairPriceBand,
  evaluateNegotiationOffer,
  haversineDistanceKm,
} from './src/engine/fishEconomics';
import {
  analyzeFishFreshnessWithAI,
  generateNegotiationReplyWithAI,
  parseVoiceListingWithAI,
} from './server/ai';
import {
  computeListingDynamicSnapshot,
  evaluateZeroWasteRouting,
  getDb,
  getFreshnessGradeHelper,
  resetDemoDb,
  saveDb,
  toPublicListing,
} from './server/store';
import type {
  FishListing,
  FreshnessAssessment,
  Negotiation,
  Order,
  Payment,
  TemperatureReading,
  TransactionRecord,
  User,
  UserRole,
} from './src/types/domain';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'FishFresh AI', region: 'Mangalore, Karnataka' });
  });

  // 1. Auth & Users
  app.get('/api/users', (_req, res) => {
    const db = getDb();
    res.json({ users: db.users });
  });

  app.post('/api/auth/login', (req, res) => {
    const { phone, role, name, locationName } = req.body as {
      phone?: string;
      role?: UserRole;
      name?: string;
      locationName?: string;
    };
    const db = getDb();

    if (phone) {
      const existing = db.users.find(
        (u) => u.phone.replace(/\s+/g, '') === phone.replace(/\s+/g, '')
      );
      if (existing) {
        return res.json({ user: existing, isNew: false });
      }
    }

    if (role && !name && !phone) {
      const demoUser = db.users.find((u) => u.role === role);
      if (demoUser) {
        return res.json({ user: demoUser, isNew: false });
      }
    }

    if (!phone || !name || !role) {
      return res.status(400).json({ error: 'Name, mobile number, and role are required.' });
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      role,
      verified: role === 'buyer',
      locationName: locationName || 'Mangalore Bunder Harbor',
      lat: 12.8582,
      lng: 74.8321,
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    if (role === 'fisherman') {
      db.fishermanProfiles.push({
        userId: newUser.id,
        boatName: 'Coastal Star',
        boatRegNo: `KA-02-MM-${Math.floor(1000 + Math.random() * 8999)}`,
        homeHarbor: newUser.locationName,
        preferredLanguage: 'kn',
        upiId: `${newUser.name.toLowerCase().split(' ')[0]}@okicici`,
        rating: 4.8,
      });
    } else if (role === 'buyer') {
      db.buyerProfiles.push({
        userId: newUser.id,
        businessName: newUser.name,
        buyerType: 'restaurant',
        completedOrdersCount: 1,
      });
    } else if (role === 'processor') {
      db.processorProfiles.push({
        userId: newUser.id,
        facilityName: newUser.name,
        processorType: 'dry_fish',
        dailyCapacityKg: 500,
        safetyCertified: false,
      });
    }
    saveDb(db);
    return res.json({ user: newUser, isNew: true });
  });

  app.patch('/api/users/:id', (req, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, locationName, lat, lng, verified } = req.body;
    if (name) user.name = name;
    if (locationName) user.locationName = locationName;
    if (typeof lat === 'number') user.lat = lat;
    if (typeof lng === 'number') user.lng = lng;
    if (typeof verified === 'boolean') user.verified = verified;
    saveDb(db);
    res.json({ user });
  });

  // 2. Species & Pricing Rules
  app.get('/api/species', (_req, res) => {
    const db = getDb();
    res.json({ species: db.fishSpecies, pricingRules: db.pricingRules });
  });

  app.patch('/api/admin/pricing-rules/:speciesId', (req, res) => {
    const db = getDb();
    const rule = db.pricingRules.find((r) => r.speciesId === req.params.speciesId);
    if (!rule) return res.status(404).json({ error: 'Pricing rule not found' });

    const { baseDemandMultiplier, maxFloorDiscountPct, freshnessPremiumPct, gradeAThreshold } =
      req.body;
    if (typeof baseDemandMultiplier === 'number') rule.baseDemandMultiplier = baseDemandMultiplier;
    if (typeof maxFloorDiscountPct === 'number') rule.maxFloorDiscountPct = maxFloorDiscountPct;
    if (typeof freshnessPremiumPct === 'number') rule.freshnessPremiumPct = freshnessPremiumPct;
    if (typeof gradeAThreshold === 'number') rule.gradeAThreshold = gradeAThreshold;
    rule.updatedAt = new Date().toISOString();

    db.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      actorId: req.body.actorId || 'usr-admin-1',
      actorRole: 'admin',
      action: 'UPDATE_PRICING_RULE',
      entityType: 'pricing_rules',
      entityId: rule.speciesId,
      details: `Updated demand multiplier=${rule.baseDemandMultiplier}, maxFloorDiscount=${rule.maxFloorDiscountPct}%`,
      timestamp: new Date().toISOString(),
    });
    saveDb(db);
    res.json({ rule });
  });

  // 3. Listings (with strict server-side floor redaction for non-owners)
  app.get('/api/listings', (req, res) => {
    const db = getDb();
    evaluateZeroWasteRouting(db);
    const viewerUserId = req.query.viewerUserId as string | undefined;
    const viewerRole = req.query.viewerRole as UserRole | undefined;
    const buyerLat = req.query.lat ? Number(req.query.lat) : undefined;
    const buyerLng = req.query.lng ? Number(req.query.lng) : undefined;

    const listings = db.fishListings.map((l) => {
      const pub = toPublicListing(l, db, { userId: viewerUserId, role: viewerRole });
      const distanceKm =
        buyerLat && buyerLng ? haversineDistanceKm(buyerLat, buyerLng, l.lat, l.lng) : undefined;
      return { ...pub, distanceKm };
    });
    res.json({ listings });
  });

  app.post('/api/listings', (req, res) => {
    const db = getDb();
    const {
      fishermanId,
      speciesId,
      quantityKg,
      catchHoursAgo,
      locationName,
      lat,
      lng,
      imageUrl,
      isLiveVerifiedCapture,
      freshnessScore,
      assessment,
      aiStartingPrice,
      minAcceptablePrice,
      storageTempC,
    } = req.body;

    if (!fishermanId || !speciesId || !quantityKg || Number(quantityKg) <= 0) {
      return res.status(400).json({ error: 'Valid fisherman, species, and quantity (kg) are required.' });
    }
    if (!isLiveVerifiedCapture) {
      return res.status(400).json({
        error: 'Official freshness verification requires a live camera capture or demo camera verification.',
      });
    }

    const fisherman = db.users.find((u) => u.id === fishermanId) ?? db.users[0];
    const fishermanProfile = db.fishermanProfiles.find((p) => p.userId === fisherman.id);
    const species = db.fishSpecies.find((s) => s.id === speciesId) ?? db.fishSpecies[0];
    const rule = db.pricingRules.find((r) => r.speciesId === species.id);

    const score = Math.max(30, Math.min(99, Number(freshnessScore) || 88));
    const gradeInfo = getFreshnessGradeHelper(score, db, species.id);
    const fairBand = calculateFairPriceBand({
      species,
      freshnessScore: score,
      quantityKg: Number(quantityKg),
      hourOfDay: new Date().getHours(),
      pricingRule: rule,
    });

    const finalStartPrice = Number(aiStartingPrice) || fairBand.aiStartingPrice;
    const finalMinFloor = Math.min(
      finalStartPrice - 5,
      Math.max(species.middlemanRatePerKg, Number(minAcceptablePrice) || fairBand.recommendedFloor)
    );

    const listingId = `lst-${Date.now()}`;
    const assessmentId = `asmt-${Date.now()}`;
    const catchTimeIso = new Date(
      Date.now() - (Number(catchHoursAgo) || 2) * 60 * 60 * 1000
    ).toISOString();

    const savedAssessment: FreshnessAssessment = {
      id: assessmentId,
      listingId,
      capturedAt: new Date().toISOString(),
      isLiveCameraCapture: Boolean(isLiveVerifiedCapture),
      gpsLat: lat ?? fisherman.lat,
      gpsLng: lng ?? fisherman.lng,
      imageUrl: imageUrl || species.defaultImageUrl,
      freshnessScore: score,
      grade: gradeInfo.grade,
      gradeLabel: gradeInfo.label,
      eyeClarity: assessment?.eyeClarity || 'Clear convex eyes',
      gillColor: assessment?.gillColor || 'Healthy crimson gill colour',
      skinSheen: assessment?.skinSheen || 'Natural marine skin sheen',
      observations: assessment?.observations || ['Live verified capture', 'Stored on crushed ice'],
      handlingUrgency: assessment?.handlingUrgency || gradeInfo.urgency,
      confidence: assessment?.confidence || 0.92,
      analysisMode: assessment?.analysisMode || 'demo-simulated',
      disclaimer:
        assessment?.disclaimer ||
        'Photograph-based grading is an AI estimate, not a food-safety certification.',
    };
    db.freshnessAssessments.unshift(savedAssessment);

    const newListing: FishListing = {
      id: listingId,
      fishermanId: fisherman.id,
      fishermanName: fisherman.name,
      boatName: fishermanProfile?.boatName || 'Coastal Catch',
      speciesId: species.id,
      speciesName: species.name,
      localName: `${species.localNameKn} / ${species.localNameTulu}`,
      totalQuantityKg: Number(quantityKg),
      availableQuantityKg: Number(quantityKg),
      catchTimestamp: catchTimeIso,
      listedAt: new Date().toISOString(),
      locationName: locationName || fisherman.locationName,
      lat: typeof lat === 'number' ? lat : fisherman.lat,
      lng: typeof lng === 'number' ? lng : fisherman.lng,
      imageUrl: imageUrl || species.defaultImageUrl,
      isLiveVerifiedCapture: true,
      freshnessScore: score,
      freshnessGrade: gradeInfo.grade,
      assessmentId,
      aiStartingPrice: finalStartPrice,
      minAcceptablePrice: finalMinFloor,
      aiRecommendedFloor: fairBand.recommendedFloor,
      marketReferencePrice: species.defaultMarketRatePerKg,
      middlemanBaselinePrice: species.middlemanRatePerKg,
      storageTempC: typeof storageTempC === 'number' ? storageTempC : 2.0,
      status: 'active',
    };

    db.fishListings.unshift(newListing);
    db.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      actorId: fisherman.id,
      actorRole: 'fisherman',
      action: 'CREATE_LISTING',
      entityType: 'fish_listings',
      entityId: listingId,
      details: `Listed ${quantityKg} kg ${species.name} at ₹${finalStartPrice}/kg`,
      timestamp: new Date().toISOString(),
    });
    saveDb(db);

    res.status(201).json({
      listing: toPublicListing(newListing, db, { userId: fisherman.id, role: 'fisherman' }),
    });
  });

  app.patch('/api/listings/:id', (req, res) => {
    const db = getDb();
    const listing = db.fishListings.find((l) => l.id === req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const { status, minAcceptablePrice, aiStartingPrice, availableQuantityKg, storageTempC, flagReason } =
      req.body;
    if (status) listing.status = status;
    if (typeof minAcceptablePrice === 'number' && minAcceptablePrice > 0) {
      listing.minAcceptablePrice = Math.min(minAcceptablePrice, listing.aiStartingPrice);
    }
    if (typeof aiStartingPrice === 'number' && aiStartingPrice > 0) {
      listing.aiStartingPrice = aiStartingPrice;
    }
    if (typeof availableQuantityKg === 'number' && availableQuantityKg >= 0) {
      listing.availableQuantityKg = availableQuantityKg;
    }
    if (typeof storageTempC === 'number') {
      listing.storageTempC = storageTempC;
    }
    if (flagReason !== undefined) {
      listing.flagReason = flagReason;
    }
    saveDb(db);

    res.json({
      listing: toPublicListing(listing, db, { userId: listing.fishermanId, role: 'fisherman' }),
    });
  });

  app.delete('/api/listings/:id', (req, res) => {
    const db = getDb();
    const idx = db.fishListings.findIndex((l) => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Listing not found' });
    db.fishListings.splice(idx, 1);
    saveDb(db);
    res.json({ deleted: true });
  });

  // Simulate a listing reaching its freshness limit for Hackathon Zero-Waste Demo
  app.post('/api/listings/:id/simulate-expiry', (req, res) => {
    const db = getDb();
    const listing = db.fishListings.find((l) => l.id === req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    // Backdate catch timestamp past max fresh window
    listing.catchTimestamp = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();
    listing.freshnessScore = 45;
    listing.freshnessGrade = 'Recovery';
    listing.status = 'active';
    const createdRequests = evaluateZeroWasteRouting(db);

    res.json({
      listing: toPublicListing(listing, db, { userId: listing.fishermanId, role: 'fisherman' }),
      createdRequests,
    });
  });

  // 4. AI Endpoints (Server-Side @google/genai + Deterministic Guardrails)
  app.post('/api/ai/freshness', async (req, res) => {
    const { imageBase64, mimeType, speciesName, isLiveCameraCapture } = req.body;
    const result = await analyzeFishFreshnessWithAI({
      imageBase64,
      mimeType,
      speciesName,
      isLiveCameraCapture: Boolean(isLiveCameraCapture),
    });
    res.json({ assessment: result });
  });

  app.post('/api/ai/voice-parse', async (req, res) => {
    const { transcript, audioBase64, audioMimeType } = req.body;
    if (!transcript && !audioBase64) {
      return res.status(400).json({ error: 'Provide a speech transcript or audio clip.' });
    }
    const parsed = await parseVoiceListingWithAI({ transcript, audioBase64, audioMimeType });
    const db = getDb();
    const species = db.fishSpecies.find((s) => s.id === parsed.speciesId) ?? db.fishSpecies[0];
    const fairBand = calculateFairPriceBand({
      species,
      freshnessScore: 88,
      quantityKg: parsed.quantityKg,
      hourOfDay: new Date().getHours(),
    });
    res.json({ parsed, fairBand });
  });

  app.post('/api/ai/fair-price', (req, res) => {
    const { speciesId, freshnessScore, quantityKg } = req.body;
    const db = getDb();
    const species = db.fishSpecies.find((s) => s.id === speciesId) ?? db.fishSpecies[0];
    const rule = db.pricingRules.find((r) => r.speciesId === species.id);
    const band = calculateFairPriceBand({
      species,
      freshnessScore: Number(freshnessScore) || 88,
      quantityKg: Number(quantityKg) || 30,
      hourOfDay: new Date().getHours(),
      pricingRule: rule,
    });
    res.json({ fairBand: band });
  });

  // 5. Negotiations (Deterministic Floor Validation + AI Phrasing)
  app.get('/api/negotiations', (req, res) => {
    const db = getDb();
    const buyerId = req.query.buyerId as string | undefined;
    const listingId = req.query.listingId as string | undefined;
    let list = db.negotiations;
    if (buyerId) list = list.filter((n) => n.buyerId === buyerId);
    if (listingId) list = list.filter((n) => n.listingId === listingId);
    res.json({ negotiations: list });
  });

  app.post('/api/negotiations/offer', async (req, res) => {
    const db = getDb();
    const { listingId, buyerId, buyerName, offerPricePerKg, requestedKg, message } = req.body;

    const listing = db.fishListings.find((l) => l.id === listingId);
    if (!listing) return res.status(404).json({ error: 'Fish listing not found' });
    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'This listing is no longer open for direct negotiation.' });
    }

    const offerPrice = Number(offerPricePerKg);
    const qtyKg = Number(requestedKg);
    if (!offerPrice || offerPrice <= 0 || !qtyKg || qtyKg <= 0) {
      return res.status(400).json({ error: 'Please provide a valid quantity (kg) and offer price (₹/kg).' });
    }

    const dynamic = computeListingDynamicSnapshot(listing, db);
    const buyerProfile = db.buyerProfiles.find((b) => b.userId === buyerId);

    // Deterministic server-side evaluation using confidential listing.minAcceptablePrice
    const evaluation = evaluateNegotiationOffer({
      buyerOfferPrice: offerPrice,
      requestedKg: qtyKg,
      availableKg: listing.availableQuantityKg,
      currentPrice: dynamic.currentPrice,
      minAcceptablePrice: listing.minAcceptablePrice,
      remainingWindowMinutes: dynamic.remainingWindowMinutes,
      buyerCompletedOrdersCount: buyerProfile?.completedOrdersCount ?? 1,
    });

    const reply = await generateNegotiationReplyWithAI({
      speciesName: listing.speciesName,
      freshnessScore: dynamic.effectiveFreshnessScore,
      currentPrice: dynamic.currentPrice,
      requestedKg: qtyKg,
      buyerOfferPrice: offerPrice,
      evaluation,
      buyerMessage: message || `I want ${qtyKg} kg at ₹${offerPrice}/kg`,
      locationName: listing.locationName,
    });

    let negotiation = db.negotiations.find(
      (n) => n.listingId === listingId && n.buyerId === buyerId && n.status === 'open'
    );
    if (!negotiation) {
      negotiation = {
        id: `neg-${Date.now()}`,
        listingId,
        buyerId: buyerId || 'usr-buyer-1',
        buyerName: buyerName || 'Buyer',
        requestedKg: qtyKg,
        currentOfferPrice: evaluation.counterPrice,
        status: 'open',
        messages: [],
        updatedAt: new Date().toISOString(),
      };
      db.negotiations.unshift(negotiation);
    }

    negotiation.requestedKg = qtyKg;
    negotiation.currentOfferPrice = evaluation.finalPrice ?? evaluation.counterPrice;
    negotiation.updatedAt = new Date().toISOString();

    negotiation.messages.push({
      id: `msg-${Date.now()}-b`,
      sender: 'buyer',
      text: message || `I want ${qtyKg} kg of ${listing.speciesName} at ₹${offerPrice}/kg.`,
      offerPricePerKg: offerPrice,
      quantityKg: qtyKg,
      timestamp: new Date().toISOString(),
    });

    negotiation.messages.push({
      id: `msg-${Date.now()}-ai`,
      sender: 'ai_agent',
      text: reply.text,
      offerPricePerKg: evaluation.finalPrice ?? evaluation.counterPrice,
      quantityKg: qtyKg,
      decision: evaluation.decision,
      aiMode: reply.aiMode,
      timestamp: new Date().toISOString(),
    });

    if (evaluation.decision === 'accept' && evaluation.finalPrice) {
      negotiation.agreedPricePerKg = evaluation.finalPrice;
    }

    db.offers.unshift({
      id: `off-${Date.now()}`,
      listingId,
      negotiationId: negotiation.id,
      buyerId: negotiation.buyerId,
      buyerName: negotiation.buyerName,
      offeredPricePerKg: offerPrice,
      quantityKg: qtyKg,
      status:
        evaluation.decision === 'accept'
          ? 'accepted'
          : evaluation.decision === 'reject'
            ? 'rejected'
            : 'countered',
      createdAt: new Date().toISOString(),
    });

    saveDb(db);
    res.json({ negotiation, evaluation });
  });

  // Accept AI counteroffer or confirm agreed deal -> locks price, reserves inventory, creates Order ID
  app.post('/api/negotiations/:id/confirm', (req, res) => {
    const db = getDb();
    const negotiation = db.negotiations.find((n) => n.id === req.params.id);
    if (!negotiation) return res.status(404).json({ error: 'Negotiation not found' });

    const listing = db.fishListings.find((l) => l.id === negotiation.listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const finalPrice = negotiation.agreedPricePerKg ?? negotiation.currentOfferPrice;
    if (finalPrice < listing.minAcceptablePrice) {
      return res.status(403).json({
        error: 'Server validation rejected price outside fisherman permitted band.',
      });
    }
    if (negotiation.requestedKg > listing.availableQuantityKg) {
      return res.status(400).json({ error: 'Insufficient remaining inventory for this quantity.' });
    }

    const { fulfillmentMode = 'dock_pickup', deliveryAddress } = req.body;

    // Reserve quantity & update listing inventory
    listing.availableQuantityKg = Math.max(0, listing.availableQuantityKg - negotiation.requestedKg);
    if (listing.availableQuantityKg === 0) {
      listing.status = 'sold_out';
    }

    negotiation.status = 'deal_confirmed';
    negotiation.agreedPricePerKg = finalPrice;
    negotiation.updatedAt = new Date().toISOString();

    const totalAmountInr = Math.round(finalPrice * negotiation.requestedKg);
    const middlemanSavingsInr = Math.max(
      0,
      Math.round((finalPrice - listing.middlemanBaselinePrice) * negotiation.requestedKg)
    );

    const orderId = `FF-2026-${Math.floor(1050 + Math.random() * 8900)}`;
    const newOrder: Order = {
      id: orderId,
      listingId: listing.id,
      speciesName: listing.speciesName,
      buyerId: negotiation.buyerId,
      buyerName: negotiation.buyerName,
      fishermanId: listing.fishermanId,
      fishermanName: listing.fishermanName,
      negotiationId: negotiation.id,
      quantityKg: negotiation.requestedKg,
      agreedPricePerKg: finalPrice,
      totalAmountInr,
      middlemanSavingsInr,
      fulfillmentMode,
      pickupLocation: listing.locationName,
      deliveryAddress,
      status: 'payment_pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.orders.unshift(newOrder);
    db.notifications.unshift(
      {
        id: `notif-${Date.now()}-f`,
        targetRole: 'fisherman',
        title: `Deal Confirmed: ${orderId}`,
        message: `${negotiation.requestedKg} kg ${listing.speciesName} locked at ₹${finalPrice}/kg (Total ₹${totalAmountInr}).`,
        severity: 'success',
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: `notif-${Date.now()}-b`,
        targetRole: 'buyer',
        title: `Order Reserved: ${orderId}`,
        message: `Proceed to simulated UPI test checkout for ${negotiation.requestedKg} kg ${listing.speciesName}.`,
        severity: 'success',
        read: false,
        createdAt: new Date().toISOString(),
      }
    );
    saveDb(db);

    res.json({
      order: newOrder,
      negotiation,
      listing: toPublicListing(listing, db, { userId: negotiation.buyerId, role: 'buyer' }),
    });
  });

  // Direct buy at current dynamic price
  app.post('/api/orders/direct', (req, res) => {
    const db = getDb();
    const { listingId, buyerId, buyerName, quantityKg, fulfillmentMode = 'dock_pickup', deliveryAddress } =
      req.body;
    const listing = db.fishListings.find((l) => l.id === listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const qty = Number(quantityKg);
    if (!qty || qty <= 0 || qty > listing.availableQuantityKg) {
      return res.status(400).json({ error: 'Invalid or unavailable quantity requested.' });
    }

    const dynamic = computeListingDynamicSnapshot(listing, db);
    const price = dynamic.currentPrice;

    listing.availableQuantityKg -= qty;
    if (listing.availableQuantityKg === 0) listing.status = 'sold_out';

    const totalAmountInr = Math.round(price * qty);
    const middlemanSavingsInr = Math.max(
      0,
      Math.round((price - listing.middlemanBaselinePrice) * qty)
    );
    const orderId = `FF-2026-${Math.floor(1050 + Math.random() * 8900)}`;

    const newOrder: Order = {
      id: orderId,
      listingId: listing.id,
      speciesName: listing.speciesName,
      buyerId: buyerId || 'usr-buyer-1',
      buyerName: buyerName || 'Buyer',
      fishermanId: listing.fishermanId,
      fishermanName: listing.fishermanName,
      quantityKg: qty,
      agreedPricePerKg: price,
      totalAmountInr,
      middlemanSavingsInr,
      fulfillmentMode,
      pickupLocation: listing.locationName,
      deliveryAddress,
      status: 'payment_pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.orders.unshift(newOrder);
    saveDb(db);
    res.status(201).json({ order: newOrder });
  });

  // 6. Orders & Simulated UPI Test Payment
  app.get('/api/orders', (_req, res) => {
    const db = getDb();
    res.json({ orders: db.orders, payments: db.payments, deliveries: db.deliveries });
  });

  app.post('/api/orders/:id/pay-test', (req, res) => {
    const db = getDb();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const upiRef = `TEST-UPI-${Math.floor(1000000 + Math.random() * 8999999)}`;
    const payment: Payment = {
      id: `pay-${Date.now()}`,
      orderId: order.id,
      method: 'upi_test',
      upiRef,
      amountInr: order.totalAmountInr,
      status: 'test_completed',
      isSimulatedTestPayment: true,
      paidAt: new Date().toISOString(),
    };
    db.payments.unshift(payment);
    order.status = order.fulfillmentMode === 'cold_delivery' ? 'pickup_delivery_in_progress' : 'payment_completed';
    order.updatedAt = new Date().toISOString();

    if (order.fulfillmentMode === 'cold_delivery') {
      db.deliveries.unshift({
        id: `del-${Date.now()}`,
        orderId: order.id,
        driverName: 'Prashanth Kulal',
        vehicleInfo: 'KA-19-C-4410 · Chilled Insulated Van',
        status: 'in_transit',
        etaMinutes: 28,
        updatedAt: new Date().toISOString(),
      });
    }

    const listing = db.fishListings.find((l) => l.id === order.listingId);
    const catchMs = listing ? new Date(listing.catchTimestamp).getTime() : Date.now() - 120 * 60 * 1000;
    const catchToSaleMinutes = Math.max(25, Math.round((Date.now() - catchMs) / 60000));

    const txn: TransactionRecord = {
      id: `txn-${Date.now()}`,
      orderId: order.id,
      type: 'direct_sale',
      speciesName: order.speciesName,
      quantityKg: order.quantityKg,
      pricePerKg: order.agreedPricePerKg,
      totalInr: order.totalAmountInr,
      fishermanExtraIncomeInr: order.middlemanSavingsInr,
      catchToSaleMinutes,
      timestamp: new Date().toISOString(),
    };
    db.transactions.unshift(txn);
    saveDb(db);

    res.json({ order, payment, transaction: txn });
  });

  app.patch('/api/orders/:id/status', (req, res) => {
    const db = getDb();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.status = req.body.status;
    order.updatedAt = new Date().toISOString();
    saveDb(db);
    res.json({ order });
  });

  // 7. Processor & Zero-Waste Module
  app.get('/api/processor/requests', (_req, res) => {
    const db = getDb();
    evaluateZeroWasteRouting(db);
    res.json({ requests: db.processorRequests });
  });

  app.post('/api/processor/requests/:id/accept', (req, res) => {
    const db = getDb();
    const procReq = db.processorRequests.find((r) => r.id === req.params.id);
    if (!procReq) return res.status(404).json({ error: 'Processor request not found' });

    const { processorId, processorName, safetyChecklistPassed, safetyNotes } = req.body;
    if (!safetyChecklistPassed) {
      return res.status(400).json({
        error: 'Safety & handling inspection checklist must be verified before accepting fish for processing.',
      });
    }

    procReq.safetyChecklistPassed = true;
    procReq.safetyNotes = safetyNotes || 'Dockside sensory, temperature, and salt-curing inspection passed.';
    procReq.status = 'accepted_by_processor';
    procReq.processorId = processorId || 'usr-proc-1';
    procReq.processorName = processorName || 'Karavali Dry-Fish & Marine Meal';
    procReq.acceptedAt = new Date().toISOString();

    const listing = db.fishListings.find((l) => l.id === procReq.listingId);
    if (listing) {
      listing.status = 'recovered';
      listing.availableQuantityKg = 0;
    }

    const totalInr = Math.round(procReq.quantityKg * procReq.recoveryPricePerKg);
    db.transactions.unshift({
      id: `txn-${Date.now()}`,
      processorRequestId: procReq.id,
      type: 'processor_recovery',
      speciesName: procReq.speciesName,
      quantityKg: procReq.quantityKg,
      pricePerKg: procReq.recoveryPricePerKg,
      totalInr,
      fishermanExtraIncomeInr: totalInr,
      catchToSaleMinutes: 520,
      timestamp: new Date().toISOString(),
    });

    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      targetRole: 'fisherman',
      title: `Zero-Waste Recovery Accepted (${procReq.quantityKg} kg)`,
      message: `${procReq.processorName} accepted ${procReq.speciesName} at ₹${procReq.recoveryPricePerKg}/kg (₹${totalInr} recovered).`,
      severity: 'success',
      read: false,
      createdAt: new Date().toISOString(),
    });

    saveDb(db);
    res.json({ request: procReq });
  });

  // 8. ESP32 IoT Temperature Sensor Stream (Simulated Hardware Mode)
  app.get('/api/iot/temperature', (_req, res) => {
    const db = getDb();
    res.json({ readings: db.temperatureReadings });
  });

  app.post('/api/iot/temperature/simulate', (req, res) => {
    const db = getDb();
    const { listingId, temperatureC } = req.body;
    const temp = typeof temperatureC === 'number' ? temperatureC : 1.9;
    const status = temp <= 3.0 ? 'optimal' : temp <= 5.5 ? 'warning' : 'critical';

    const reading: TemperatureReading = {
      id: `temp-${Date.now()}`,
      deviceId: 'ESP32-ICEBOX-BUNDER-01',
      listingId,
      locationLabel: 'Simulated ESP32 Ice-Box Node',
      temperatureC: temp,
      humidityPct: 87,
      status,
      isSimulated: true,
      recordedAt: new Date().toISOString(),
    };
    db.temperatureReadings.unshift(reading);
    if (listingId) {
      const listing = db.fishListings.find((l) => l.id === listingId);
      if (listing) listing.storageTempC = temp;
    }
    saveDb(db);
    res.json({ reading });
  });

  // 9. Analytics, Notifications, Audit Logs & Demo Reset
  app.get('/api/analytics', (_req, res) => {
    const db = getDb();
    const totalKgSold = db.transactions
      .filter((t) => t.type === 'direct_sale')
      .reduce((acc, t) => acc + t.quantityKg, 0);

    const totalKgSavedFromWaste = db.processorRequests
      .filter((r) => r.status === 'accepted_by_processor' || r.status === 'completed')
      .reduce((acc, r) => acc + r.quantityKg, 0);

    const totalRevenueInr = db.transactions.reduce((acc, t) => acc + t.totalInr, 0);
    const totalExtraIncomeInr = db.transactions.reduce((acc, t) => acc + t.fishermanExtraIncomeInr, 0);

    const activeListings = db.fishListings.filter((l) => l.status === 'active');
    const avgFreshnessScore =
      activeListings.length > 0
        ? Math.round(activeListings.reduce((a, b) => a + b.freshnessScore, 0) / activeListings.length)
        : 88;

    const avgCatchToSaleMinutes =
      db.transactions.length > 0
        ? Math.round(
            db.transactions.reduce((a, b) => a + b.catchToSaleMinutes, 0) / db.transactions.length
          )
        : 120;

    // Species breakdown
    const speciesMap = new Map<string, { species: string; kgSold: number; revenueInr: number }>();
    for (const t of db.transactions) {
      const curr = speciesMap.get(t.speciesName) ?? { species: t.speciesName, kgSold: 0, revenueInr: 0 };
      curr.kgSold += t.quantityKg;
      curr.revenueInr += t.totalInr;
      speciesMap.set(t.speciesName, curr);
    }

    res.json({
      summary: {
        registeredFishermen: db.users.filter((u) => u.role === 'fisherman').length,
        registeredBuyers: db.users.filter((u) => u.role === 'buyer').length,
        registeredProcessors: db.users.filter((u) => u.role === 'processor').length,
        activeListingsCount: activeListings.length,
        totalOrdersCount: db.orders.length,
        totalKgSold,
        totalKgSavedFromWaste,
        totalRevenueInr,
        totalExtraIncomeInr,
        avgFreshnessScore,
        avgCatchToSaleMinutes,
        openNegotiationsCount: db.negotiations.filter((n) => n.status === 'open').length,
        flaggedListingsCount: db.fishListings.filter((l) => l.status === 'flagged').length,
      },
      speciesBreakdown: Array.from(speciesMap.values()),
      transactions: db.transactions,
      notifications: db.notifications,
      auditLogs: db.auditLogs,
    });
  });

  app.post('/api/demo/reset', (_req, res) => {
    const db = resetDemoDb();
    res.json({ ok: true, listingsCount: db.fishListings.length });
  });

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FishFresh AI server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
