"""Thin wrapper around the Anthropic API using tool use for structured output.

Model-agnostic on purpose: no temperature/top_p (Haiku 5.5 rejects them), no
prefill, and tool_choice stays 'auto' (forced tool use is rejected by some 5.5
models). We tell the model in the prompt to call the tool, and retry once if
it answers in plain text."""
import logging
from dataclasses import dataclass

from ..config import config

log = logging.getLogger(__name__)


class LLMError(Exception):
    """Message is safe to show to the end user."""


@dataclass
class ToolResult:
    data: dict
    input_tokens: int
    output_tokens: int


def call_tool(*, model: str, system: str, user: str, tool_name: str,
              tool_description: str, schema: dict, max_tokens: int = 8192) -> ToolResult:
    if not config.anthropic_api_key:
        raise LLMError("The Anthropic API key is not configured. Add ANTHROPIC_API_KEY to backend/.env and restart the server.")

    import anthropic

    client = anthropic.Anthropic(api_key=config.anthropic_api_key, max_retries=3, timeout=120.0)
    tools = [{"name": tool_name, "description": tool_description, "input_schema": schema}]
    total_in = total_out = 0

    for attempt in range(2):
        content = user if attempt == 0 else f"{user}\n\nIMPORTANT: respond only by calling the {tool_name} tool."
        try:
            resp = client.messages.create(
                model=model, max_tokens=max_tokens, system=system, tools=tools,
                tool_choice={"type": "auto"},
                messages=[{"role": "user", "content": content}],
            )
        except anthropic.AuthenticationError:
            raise LLMError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in backend/.env.")
        except anthropic.PermissionDeniedError:
            raise LLMError("The Anthropic API key doesn't have permission to use this model.")
        except anthropic.NotFoundError:
            raise LLMError(f"The model '{model}' was not found on your Anthropic account.")
        except anthropic.RateLimitError:
            raise LLMError("Anthropic rate limit reached. Wait a minute and re-run the analysis.")
        except anthropic.APIConnectionError:
            raise LLMError("Could not reach the Anthropic API. Check your internet connection and retry.")
        except anthropic.APIStatusError as exc:
            # includes billing problems such as "credit balance is too low"
            raise LLMError(f"Anthropic API error ({exc.status_code}): {getattr(exc, 'message', exc)}")

        usage = getattr(resp, "usage", None)
        total_in += getattr(usage, "input_tokens", 0) or 0
        total_out += getattr(usage, "output_tokens", 0) or 0

        if resp.stop_reason == "max_tokens":
            raise LLMError("Claude's response was cut off (the call may be too long to analyse in one pass).")

        for block in resp.content:
            if getattr(block, "type", None) == "tool_use" and block.name == tool_name:
                return ToolResult(dict(block.input), total_in, total_out)
        log.warning("Attempt %d: model did not call %s; stop_reason=%s", attempt + 1, tool_name, resp.stop_reason)

    raise LLMError("Claude did not return a structured result. Please re-run the analysis.")
