import { buildUtterances, type ScriptLine } from "../script"
import { NO_ISSUES_RAW } from "../derive"
import type { RawAnalysis, Scenario } from "../types"
import { calm, flagged } from "./voiceLines"

/**
 * The interviewer's case: the words look fairly neutral, the DELIVERY is angry.
 * Try it at each Voice setting (Settings > Voice analysis):
 *   Off        -> GREEN (words only)
 *   Supporting -> RED, because line 4 is also dismissive in words
 *   Strong     -> RED, and line 6 (neutral words, heated delivery) counts as evidence too
 */
const LINES: ScriptLine[] = [
  ["A", "Orbit Support, this is Ravi."],
  ["B", "Hi, our dashboard has been down since this morning and this is the third time this month."],
  ["A", "Okay. Have you tried clearing your cache?"],
  ["B", "Yes, twice. Can someone actually look at the server side?"],
  ["A", "That's not my problem."],
  ["B", "Sorry? You're support. Who handles it, then?"],
  ["A", "The server team handles that. You'd need to raise a ticket."],
  ["B", "Fine. Can you raise the ticket for me, please?"],
  ["A", "I'll raise a ticket and send you the reference number today."],
  ["B", "Thank you."],
  ["A", "Sure."],
]

const RAW: RawAnalysis = {
  negative: true,
  confidence: 0.8,
  explanation:
    "The rep's words are mostly brief and procedural, but the delivery of “That's not my problem” was angry and the next line was " +
    "tense and clipped. Together they read as dismissive of a customer who had already tried the obvious fixes.",
  evidence: [
    {
      utterance_index: 4,
      quote: "That's not my problem",
      criterion: "dismissiveness",
      severity: "high",
      explanation: "Brushes off the request; the voice was measured as angry.",
      basis: "words_and_voice",
    },
    {
      utterance_index: 6,
      quote: "The server team handles that",
      criterion: "hostility",
      severity: "medium",
      explanation: "Neutral wording, but delivered in a heated, intense way.",
      basis: "voice",
    },
  ],
}

export const voiceScenario: Scenario = {
  key: "voice",
  jobId: "c4d8e1f0-93aa-4b57-8d3e-5f6a7b8c9d03",
  filename: "Orbit_support_tense.m4a",
  sizeBytes: 1_210_000,
  language_code: "en",
  utterances: buildUtterances(LINES, 4000),
  inferredSpeakers: [
    { label: "A", role: "rep", role_confidence: 0.95, role_source: "auto", role_reasoning: "Answers with the company name and handles the support request." },
    { label: "B", role: "customer", role_confidence: 0.95, role_source: "auto", role_reasoning: "Reports an outage." },
  ],
  summary:
    "The customer reports a dashboard outage they have already tried to fix. The rep deflects it to another team, then agrees to raise a ticket and send a reference number.",
  raw: (rep) => (rep === "A" ? RAW : NO_ISSUES_RAW),
  voice: {
    quality: 0.82,
    lines: {
      0: calm(0.32),
      1: calm(0.55, -0.3),
      2: calm(0.38),
      3: calm(0.5, -0.4),
      4: flagged("angry", 0.88, -0.7, 2.6),
      5: calm(0.52, -0.5),
      6: flagged("heated", 0.7, -0.5, 1.9),
      7: calm(0.4, -0.2),
      8: calm(0.36),
      9: calm(0.3),
      10: calm(0.34),
    },
  },
  pool: [
    {
      utterance_index: 8,
      quote: "I'll raise a ticket and send you the reference number today",
      description: "Raise a support ticket and send the reference number",
      item_type: "send_information",
      deadline_text: "today",
      confidence: 0.93,
    },
  ],
}
