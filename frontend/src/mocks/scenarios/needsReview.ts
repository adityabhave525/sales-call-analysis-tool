import { buildUtterances, type ScriptLine } from "../script"
import type { RawAnalysis, Scenario } from "../types"

/**
 * Outbound call: the CUSTOMER (A) answers first ("Hello?"), so the role guess is wrong.
 * The real rep is Priya (B). Swapping roles + re-analysing should give a clean GREEN
 * and flip the action-item owners from "customer" to "rep".
 */
const LINES: ScriptLine[] = [
  ["A", "Hello?"],
  ["B", "Hi, is this Mr. Alvarez? It's Priya from Summit Insurance, returning your call from this morning."],
  ["A", "Oh yes. Look, I've already explained this twice to your colleagues. My policy renewal quote doubled and nobody can tell me why."],
  ["B", "I'm sorry about that, I can see your notes here. Let me pull up the renewal and see what changed."],
  ["A", "I don't have all day, either. Just give me a straight answer."],
  ["B", "Understood. The increase is mostly from a claim on the account in March and an updated vehicle rating."],
  ["A", "That claim wasn't my fault. I'm not paying for something that wasn't my fault."],
  ["B", "That's fair, and I can ask our underwriting team to review whether the claim was recorded as at-fault."],
  ["A", "Fine. How long will that take?"],
  ["B", "Usually three to five business days. I'll email you a case number today so you can track it."],
  ["A", "Okay. Just make sure someone actually calls me back this time."],
  ["B", "I'll call you back myself on Friday with an update."],
  ["A", "Alright. Goodbye."],
]

/** What the pretend model says when it (wrongly) treats A as the rep. */
const WRONG_REP_RAW: RawAnalysis = {
  negative: true,
  confidence: 0.55,
  explanation:
    "The rep's remarks (“I don't have all day” and having already explained the issue twice) can read as impatient. " +
    "The evidence is limited, and the rep/customer assignment is uncertain.",
  evidence: [
    {
      utterance_index: 2,
      quote: "I've already explained this twice to your colleagues",
      criterion: "dismissiveness",
      severity: "low",
      explanation: "Brushes off the exchange by pointing to earlier conversations.",
    },
    {
      utterance_index: 4,
      quote: "I don't have all day, either",
      criterion: "dismissiveness",
      severity: "medium",
      explanation: "Pressures the other party to hurry.",
    },
    {
      // Not in the transcript on purpose: shows the verifier dropping a fabricated quote.
      utterance_index: 6,
      quote: "That's not my problem",
      criterion: "rudeness",
      severity: "high",
      explanation: "Refuses responsibility.",
    },
  ],
}

const CORRECT_REP_RAW: RawAnalysis = {
  negative: false,
  confidence: 0.9,
  explanation:
    "The rep stayed calm and professional under pressure: she acknowledged the customer's frustration, gave a direct explanation for " +
    "the price increase, and offered concrete next steps. The customer's irritation is not counted against her.",
  evidence: [],
}

export const needsReviewScenario: Scenario = {
  key: "needsReview",
  jobId: "c41e8f07-9d2a-4b63-b5f0-3e7a1c6d9f03",
  filename: "Summit_renewal_callback.m4a",
  sizeBytes: 1_310_000,
  language_code: "en",
  utterances: buildUtterances(LINES, 3000),
  inferredSpeakers: [
    { label: "A", role: "rep", role_confidence: 0.45, role_source: "auto", role_reasoning: "Spoke first, but the excerpt does not clearly show who represents a company." },
    { label: "B", role: "customer", role_confidence: 0.41, role_source: "auto", role_reasoning: "Inferred as the opposite of the other speaker." },
  ],
  summary:
    "An outbound call about a policy renewal that doubled in price. The agent explains the increase, offers to have underwriting " +
    "review a claim, and promises a case number by email and a Friday callback.",
  raw: (rep) => (rep === "B" ? CORRECT_REP_RAW : WRONG_REP_RAW),
  pool: [
    {
      utterance_index: 7,
      quote: "I can ask our underwriting team to review whether the claim was recorded as at-fault",
      description: "Ask underwriting to review whether the March claim was at-fault",
      item_type: "commitment",
      deadline_text: null,
      confidence: 0.85,
    },
    {
      utterance_index: 9,
      quote: "I'll email you a case number today",
      description: "Email a case number to the customer",
      item_type: "send_information",
      deadline_text: "today",
      confidence: 0.9,
    },
    {
      utterance_index: 11,
      quote: "I'll call you back myself on Friday with an update",
      description: "Call the customer back with an update",
      item_type: "follow_up",
      deadline_text: "on Friday",
      confidence: 0.9,
    },
  ],
}
