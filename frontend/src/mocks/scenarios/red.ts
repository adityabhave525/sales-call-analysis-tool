import { buildUtterances, type ScriptLine } from "../script"
import { NO_ISSUES_RAW } from "../derive"
import type { RawAnalysis, Scenario } from "../types"

const LINES: ScriptLine[] = [
  ["A", "BrightPath Software, Dave speaking. How can I help you?"],
  ["B", "Hi Dave, I'm calling about the invoice for our team plan. We were charged for twelve seats but we only have eight users."],
  ["A", "Okay. Did you reduce the seats in the portal before the billing date?"],
  ["B", "I didn't know I had to do that. Nobody told me when we signed up."],
  ["A", "It's in the terms. Everyone has to read the terms, that's not really something I can fix."],
  ["B", "I understand, but I've been a customer for three years, and I'd like to at least understand my options."],
  ["A", "Look, I already told you the options. You could have changed it in the portal. That's on you."],
  ["B", "I'm sorry, I'm only trying to find a way to sort this out. Could you maybe escalate this to someone?"],
  ["A", "I really don't have time to go back and forth on something this small. Honestly, it's twelve seats, just pay it."],
  ["B", "That's not very helpful. I'd like to speak with your manager please."],
  ["A", "Fine. I'll put a note in, but don't expect a call back quickly. Managers are busy with real problems."],
  ["B", "Okay. Can you at least send me a copy of the invoice breakdown so I can show my finance team?"],
  ["A", "I'll email you the invoice breakdown by end of day."],
  ["B", "Thank you. And the manager will call me this week?"],
  ["A", "Someone might call you on Thursday, I can't promise anything."],
  ["B", "Alright. Thank you for your time."],
  ["A", "Yeah. Bye."],
]

/** Dave (A) is the rep. Confidence 0.78: RED at Balanced/Strict, flips to GREEN + review at Lenient. */
const RED_RAW: RawAnalysis = {
  negative: true,
  confidence: 0.78,
  explanation:
    "The rep repeatedly dismissed the customer's concern, blamed them for the billing problem, and refused to engage " +
    "(“That's on you”, “I really don't have time…”). The customer stayed polite throughout while the rep's tone worsened as the call went on.",
  evidence: [
    {
      utterance_index: 4,
      quote: "that's not really something I can fix",
      criterion: "dismissiveness",
      severity: "medium",
      explanation: "Deflects responsibility instead of helping with the billing issue.",
    },
    {
      utterance_index: 6,
      quote: "That's on you",
      criterion: "hostility",
      severity: "high",
      explanation: "Blames the customer directly.",
    },
    {
      utterance_index: 8,
      quote: "I really don't have time to go back and forth on something this small",
      criterion: "dismissiveness",
      severity: "high",
      explanation: "Minimises the customer's concern and refuses to engage.",
    },
    {
      utterance_index: 10,
      quote: "Managers are busy with real problems",
      criterion: "rudeness",
      severity: "medium",
      explanation: "Implies the customer's issue is unimportant.",
    },
  ],
}

export const redScenario: Scenario = {
  key: "red",
  jobId: "7f3c1e52-0a41-4d2b-9a77-1c5e2d8b4a01",
  filename: "BrightPath_billing_dispute.m4a",
  sizeBytes: 1_906_000,
  language_code: "en",
  utterances: buildUtterances(LINES, 1000),
  inferredSpeakers: [
    { label: "A", role: "rep", role_confidence: 0.96, role_source: "auto", role_reasoning: "Answers with the company name and offers support." },
    { label: "B", role: "customer", role_confidence: 0.94, role_source: "auto", role_reasoning: "Calls about a problem with an invoice." },
  ],
  summary:
    "The customer disputes being billed for 12 seats when only 8 are in use. The rep points to the terms, declines to adjust the invoice, " +
    "and agrees to send an invoice breakdown and note a request for a manager callback.",
  raw: (rep) => (rep === "A" ? RED_RAW : NO_ISSUES_RAW),
  pool: [
    {
      utterance_index: 12,
      quote: "I'll email you the invoice breakdown by end of day",
      description: "Email the invoice breakdown to the customer",
      item_type: "send_information",
      deadline_text: "by end of day",
      confidence: 0.95,
    },
    {
      utterance_index: 10,
      quote: "I'll put a note in",
      description: "Add a note requesting a manager follow-up",
      item_type: "commitment",
      deadline_text: null,
      confidence: 0.8,
    },
    {
      utterance_index: 14,
      quote: "Someone might call you on Thursday",
      description: "Possible manager callback",
      item_type: "follow_up",
      deadline_text: "on Thursday",
      confidence: 0.5,
      loose: true,
      ownerUnclear: true,
    },
  ],
}
