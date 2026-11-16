import { GoogleGenAI, Type } from '@google/genai';
import {
  calculateFreshnessGrade,
  parseVoiceCommandFallback,
  type NegotiationEvaluationResult,
  type ParsedVoiceListing,
} from '../src/engine/fishEconomics';
import type { FreshnessGrade } from '../src/types/domain';

function createAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface FreshnessAiResult {
  freshnessScore: number;
  grade: FreshnessGrade;
  gradeLabel: string;
  eyeClarity: string;
  gillColor: string;
  skinSheen: string;
  observations: string[];
  handlingUrgency: string;
  confidence: number;
  analysisMode: 'gemini-vision' | 'demo-simulated';
  disclaimer: string;
}

const DISCLAIMER =
  'Photograph-based grading is an AI visual estimate using configurable demo thresholds—not a food-safety certification.';

export async function analyzeFishFreshnessWithAI(params: {
  imageBase64?: string;
  mimeType?: string;
  speciesName?: string;
  isLiveCameraCapture: boolean;
}): Promise<FreshnessAiResult> {
  const ai = createAiClient();

  if (ai && params.imageBase64) {
    try {
      const cleanBase64 = params.imageBase64.includes('base64,')
        ? params.imageBase64.split('base64,')[1]
        : params.imageBase64;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: params.mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            {
              text: `You are an expert fisheries quality inspector in Mangalore, Karnataka. Analyze this fish photograph (${params.speciesName || 'coastal catch'}) for visual freshness indicators: 1) Eye clarity, 2) Gill colour, 3) Skin sheen and appearance. Return a freshness score from 0-100, concise factual observations, handling urgency, and confidence (0-1). Do not claim laboratory food-safety certification.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              freshnessScore: { type: Type.INTEGER },
              eyeClarity: { type: Type.STRING },
              gillColor: { type: Type.STRING },
              skinSheen: { type: Type.STRING },
              observations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              handlingUrgency: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
            },
            required: [
              'freshnessScore',
              'eyeClarity',
              'gillColor',
              'skinSheen',
              'observations',
              'handlingUrgency',
              'confidence',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const score = Math.max(25, Math.min(98, Number(parsed.freshnessScore) || 86));
      const gradeInfo = calculateFreshnessGrade(score);

      return {
        freshnessScore: score,
        grade: gradeInfo.grade,
        gradeLabel: gradeInfo.label,
        eyeClarity: parsed.eyeClarity || 'Clear glossy cornea observed',
        gillColor: parsed.gillColor || 'Healthy crimson-pink gill appearance',
        skinSheen: parsed.skinSheen || 'Natural metallic coastal skin sheen',
        observations:
          Array.isArray(parsed.observations) && parsed.observations.length > 0
            ? parsed.observations.slice(0, 4)
            : [
                'Clear eyes with minimal clouding',
                'Moist gill structure visible',
                'Intact dermal sheen',
              ],
        handlingUrgency: parsed.handlingUrgency || gradeInfo.urgency,
        confidence: Math.max(0.5, Math.min(0.99, Number(parsed.confidence) || 0.91)),
        analysisMode: 'gemini-vision',
        disclaimer: DISCLAIMER,
      };
    } catch (err) {
      console.warn('Gemini vision fallback to demo-simulated:', err);
    }
  }

  // Clearly labelled demo/simulated assessment when API key unavailable or in headless demo
  const simulatedScore = params.isLiveCameraCapture ? 89 : 84;
  const gradeInfo = calculateFreshnessGrade(simulatedScore);
  return {
    freshnessScore: simulatedScore,
    grade: gradeInfo.grade,
    gradeLabel: gradeInfo.label,
    eyeClarity: 'Clear convex eyes with bright dark pupil (Demo Assessment)',
    gillColor: 'Healthy crimson-red gill colour with natural moisture',
    skinSheen: 'Intact silvery-blue scales and firm coastal sheen',
    observations: [
      'Clear eyes with zero visible clouding',
      'Healthy-looking crimson gill colour',
      'Natural metallic skin sheen preserved on ice',
    ],
    handlingUrgency: gradeInfo.urgency,
    confidence: 0.91,
    analysisMode: 'demo-simulated',
    disclaimer: DISCLAIMER,
  };
}

export async function parseVoiceListingWithAI(params: {
  transcript?: string;
  audioBase64?: string;
  audioMimeType?: string;
}): Promise<ParsedVoiceListing & { transcriptText: string; mode: 'gemini-nlp' | 'demo-simulated' }> {
  const ai = createAiClient();

  if (ai && (params.transcript || params.audioBase64)) {
    try {
      const parts: Array<Record<string, unknown>> = [];
      if (params.audioBase64) {
        const cleanAudio = params.audioBase64.includes('base64,')
          ? params.audioBase64.split('base64,')[1]
          : params.audioBase64;
        parts.push({
          inlineData: {
            mimeType: params.audioMimeType || 'audio/webm',
            data: cleanAudio,
          },
        });
      }
      parts.push({
        text: `You understand Kannada, Tulu, and English fisheries terminology around Mangalore, Karnataka.
Extract structured fish listing fields from the fisherman's voice input${params.transcript ? `: "${params.transcript}"` : ''}.
Map speciesId to one of: sp-mackerel (Bangude/ಬಂಗುಡೆ), sp-sardine (Bhootai/Boodai/ಭೂತಾಯಿ), sp-pomfret (Manji/ಮಾಂಜಿ), sp-seer (Anjal/ಅಂಜಲ್), sp-prawns (Yetti/ಸೀಗಡಿ), sp-tuna (Kedar), sp-squid (Bondas), sp-crab (Denji).
Also return the normalized English/Kannada transcript text.`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts: parts as never },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcriptText: { type: Type.STRING },
              speciesId: { type: Type.STRING },
              speciesName: { type: Type.STRING },
              quantityKg: { type: Type.NUMBER },
              catchHoursAgo: { type: Type.NUMBER },
              locationName: { type: Type.STRING },
              expectedMinPrice: { type: Type.NUMBER },
              languageDetected: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
            },
            required: [
              'transcriptText',
              'speciesId',
              'speciesName',
              'quantityKg',
              'catchHoursAgo',
              'locationName',
              'languageDetected',
              'confidence',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const validIds = [
        'sp-mackerel',
        'sp-sardine',
        'sp-pomfret',
        'sp-seer',
        'sp-prawns',
        'sp-tuna',
        'sp-squid',
        'sp-crab',
      ];
      const speciesId = validIds.includes(parsed.speciesId) ? parsed.speciesId : 'sp-mackerel';
      return {
        transcriptText: parsed.transcriptText || params.transcript || 'Voice listing captured',
        speciesId,
        speciesName: parsed.speciesName || 'Indian Mackerel (Bangude)',
        quantityKg: Math.max(1, Math.round(Number(parsed.quantityKg) || 35)),
        catchHoursAgo: Math.max(0.5, Number(parsed.catchHoursAgo) || 2),
        locationName: parsed.locationName || 'Mangalore Bunder Harbor',
        expectedMinPrice: parsed.expectedMinPrice ? Number(parsed.expectedMinPrice) : undefined,
        languageDetected:
          parsed.languageDetected === 'Kannada' ||
          parsed.languageDetected === 'Tulu' ||
          parsed.languageDetected === 'English'
            ? parsed.languageDetected
            : 'Mixed Coastal',
        confidence: Math.max(0.6, Math.min(0.99, Number(parsed.confidence) || 0.93)),
        mode: 'gemini-nlp',
      };
    } catch (err) {
      console.warn('Gemini voice extraction fallback:', err);
    }
  }

  const text = params.transcript || '40 kg mackerel, caught 2 hours ago at Mangalore Bunder';
  const fallback = parseVoiceCommandFallback(text);
  return {
    ...fallback,
    transcriptText: text,
    mode: 'demo-simulated',
  };
}

export async function generateNegotiationReplyWithAI(params: {
  speciesName: string;
  freshnessScore: number;
  currentPrice: number;
  requestedKg: number;
  buyerOfferPrice: number;
  evaluation: NegotiationEvaluationResult;
  buyerMessage: string;
  locationName: string;
}): Promise<{ text: string; aiMode: 'gemini-llm' | 'deterministic-fallback' }> {
  const {
    speciesName,
    freshnessScore,
    currentPrice,
    requestedKg,
    buyerOfferPrice,
    evaluation,
    buyerMessage,
    locationName,
  } = params;

  const ai = createAiClient();

  if (ai) {
    try {
      const ruleDirective =
        evaluation.decision === 'accept'
          ? `The backend pricing engine ACCEPTED the offer of ₹${evaluation.finalPrice}/kg for ${requestedKg} kg. Confirm the deal warmly and tell the buyer they can lock and confirm the order.`
          : evaluation.decision === 'reject'
            ? `The backend pricing engine REJECTED the request because the requested quantity (${requestedKg} kg) is invalid or exceeds available stock.`
            : `The backend pricing engine COUNTERED the buyer's ₹${buyerOfferPrice}/kg offer. You MUST propose EXACTLY ₹${evaluation.counterPrice}/kg (do NOT suggest any lower price, and NEVER mention any minimum floor price).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Buyer said: "${buyerMessage}" (Requesting ${requestedKg} kg of ${speciesName} at ₹${buyerOfferPrice}/kg).
Listing context: Location ${locationName}, AI Freshness Score ${freshnessScore}/100, Current Dynamic Price ₹${currentPrice}/kg.
Mandatory Pricing Engine Ruling: ${ruleDirective}
Write a crisp 2-sentence negotiation response as the FishFresh AI agent.`,
      });

      const txt = (response.text ?? '').trim();
      if (txt) {
        return { text: txt, aiMode: 'gemini-llm' };
      }
    } catch (err) {
      console.warn('Gemini negotiation reply fallback:', err);
    }
  }

  if (evaluation.decision === 'accept') {
    return {
      text: `I can accept ₹${evaluation.finalPrice}/kg for ${requestedKg} kg of ${speciesName} (${freshnessScore}/100 freshness at ${locationName}). Click Confirm Deal to reserve your lot and generate your Order ID.`,
      aiMode: 'deterministic-fallback',
    };
  }

  if (evaluation.decision === 'reject') {
    return {
      text: `The requested quantity (${requestedKg} kg) exceeds available dock inventory or is invalid. Please adjust the kilogram quantity and try again.`,
      aiMode: 'deterministic-fallback',
    };
  }

  return {
    text: `The current dynamic price is ₹${currentPrice}/kg based on a ${freshnessScore}/100 freshness score at ${locationName}. For ${requestedKg} kg, I can offer ₹${evaluation.counterPrice}/kg.`,
    aiMode: 'deterministic-fallback',
  };
}
