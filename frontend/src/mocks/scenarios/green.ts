import { buildUtterances, type ScriptLine } from "../script"
import { NO_ISSUES_RAW } from "../derive"
import type { Scenario } from "../types"

const LINES: ScriptLine[] = [
  ["A", "Hi, this is Maya from Northwind Analytics. Is this a good time to talk?"],
  ["B", "Yes, I've got about fifteen minutes. We're looking at replacing our reporting tool."],
  ["A", "Great. Can you tell me what's not working with the current one?"],
  ["B", "Mostly it's slow, and our sales managers can't build their own dashboards."],
  ["A", "That's a common problem. Our dashboards are drag and drop, so managers can build them without the analytics team."],
  ["B", "That sounds good. What does pricing look like for around forty users?"],
  ["A", "For forty users it's about two thousand two hundred a month on the annual plan. I'll send you a detailed quote with the volume discount included."],
  ["B", "Please do. When could I see a demo? I'd want my head of sales to join."],
  ["A", "I can set up a demo for next Tuesday at 2 PM. Does that work for you both?"],
  ["B", "Tuesday at two works. I'll check with her and confirm tomorrow morning."],
  ["A", "Perfect. I'll send a calendar invite once you confirm, and I'll include the security documentation your IT team will ask about."],
  ["B", "That would help a lot. Thanks, Maya."],
  ["A", "My pleasure. Thanks for your time today, talk to you Tuesday!"],
]

export const greenScenario: Scenario = {
  key: "green",
  jobId: "2b9d6a14-5c3e-4f08-8e21-7a0c9b1d3e02",
  filename: "Northwind_discovery_call.m4a",
  sizeBytes: 1_520_000,
  language_code: "en",
  utterances: buildUtterances(LINES, 2000),
  inferredSpeakers: [
    { label: "A", role: "rep", role_confidence: 0.97, role_source: "auto", role_reasoning: "Introduces herself and the company, then presents pricing and a demo." },
    { label: "B", role: "customer", role_confidence: 0.95, role_source: "auto", role_reasoning: "Describes a problem and asks about pricing and a demo." },
  ],
  summary:
    "A discovery call. The customer wants to replace a slow reporting tool. The rep explains the dashboards and pricing, " +
    "offers a demo next Tuesday, and promises a quote, a calendar invite and security documentation.",
  raw: (rep) =>
    rep === "A"
      ? {
          negative: false,
          confidence: 0.94,
          explanation:
            "The rep was courteous and attentive throughout: she checked whether it was a good time, asked open discovery questions, " +
            "and answered the pricing and demo requests directly. No rude, hostile or dismissive language was found.",
          evidence: [],
        }
      : NO_ISSUES_RAW,
  pool: [
    {
      utterance_index: 6,
      quote: "I'll send you a detailed quote with the volume discount included",
      description: "Send a detailed quote including the volume discount",
      item_type: "send_information",
      deadline_text: null, // not stated: UI shows "Not specified"
      confidence: 0.92,
    },
    {
      utterance_index: 8,
      quote: "I can set up a demo for next Tuesday at 2 PM",
      description: "Hold a demo with the customer and their head of sales",
      item_type: "schedule_meeting",
      deadline_text: "next Tuesday at 2 PM",
      confidence: 0.85,
    },
    {
      utterance_index: 9,
      quote: "I'll check with her and confirm tomorrow morning",
      description: "Confirm the demo time with the head of sales",
      item_type: "commitment",
      deadline_text: "tomorrow morning",
      confidence: 0.9,
    },
    {
      utterance_index: 10,
      quote: "I'll send a calendar invite once you confirm",
      description: "Send a calendar invite once the customer confirms",
      item_type: "commitment",
      deadline_text: null,
      confidence: 0.9,
    },
    {
      utterance_index: 10,
      quote: "I'll include the security documentation your IT team will ask about",
      description: "Include security documentation with the invite",
      item_type: "send_information",
      deadline_text: null,
      confidence: 0.8,
    },
    {
      utterance_index: 12,
      quote: "talk to you Tuesday",
      description: "Speak again on Tuesday",
      item_type: "follow_up",
      deadline_text: "Tuesday",
      confidence: 0.5,
      loose: true,
    },
  ],
}
