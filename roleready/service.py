import re

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    OpenAI,
    PermissionDeniedError,
    RateLimitError,
)
from pydantic import ValidationError

from .errors import GenerationError, InputError
from .models import Analysis, Revision
from .prompts import build_messages, build_refinement_messages
from .validation import (
    MAX_FEEDBACK_CHARS,
    quote_in,
    validate_grounding,
    validate_inputs,
    validate_rewrite,
    validate_text,
)

DEFAULT_MODEL = "gpt-4o-mini"


def validate_model(model: str) -> str:
    model = model.strip()
    if not re.fullmatch(r"[a-zA-Z0-9_.:-]{1,100}", model):
        raise InputError("Enter a valid OpenAI model ID (letters, numbers, dots, colons, underscores, or dashes).")
    return model


class OpenAIReviewer:
    def __init__(self, api_key: str, model: str = DEFAULT_MODEL, client=None):
        if not api_key.strip():
            raise InputError("Add your OpenAI API key in the sidebar or .env before using Live mode.")
        self.model = validate_model(model)
        # Do not inherit a custom base URL that could redirect private resume content.
        self.client = client or OpenAI(
            api_key=api_key.strip(),
            base_url="https://api.openai.com/v1",
            timeout=60.0,
            max_retries=1,
        )

    def close(self):
        self.client.close()

    def _parse(self, messages: list[dict], schema):
        try:
            response = self.client.responses.parse(
                model=self.model,
                input=messages,
                text_format=schema,
                max_output_tokens=6500,
                store=False,
            )
            if response.status != "completed":
                raise GenerationError("The response was incomplete. Shorten your inputs or try again.")
            if any(getattr(part, "type", None) == "refusal" for item in response.output for part in getattr(item, "content", [])):
                raise GenerationError("The model declined this request. Check your inputs and try again.")
            if response.output_parsed is None:
                raise GenerationError("No valid structured result was returned. Please try again.")
            return schema.model_validate(response.output_parsed)
        except AuthenticationError:
            raise GenerationError("OpenAI rejected the API key. Check it in your OpenAI account.") from None
        except PermissionDeniedError:
            raise GenerationError("Your OpenAI account cannot use this model. Choose an available model.") from None
        except RateLimitError:
            raise GenerationError("OpenAI rate or quota limit reached. Check API billing and try again later.") from None
        except APITimeoutError:
            raise GenerationError("OpenAI timed out. Please try again shortly.") from None
        except APIConnectionError:
            raise GenerationError("Could not connect to OpenAI. Check your internet connection.") from None
        except BadRequestError:
            raise GenerationError(
                "OpenAI rejected the request. Check that your model supports Responses and Structured Outputs, or shorten the inputs."
            ) from None
        except APIStatusError:
            raise GenerationError("OpenAI is unavailable for this request. Please try again later.") from None
        except (ValidationError, ValueError, TypeError):
            raise GenerationError("The model returned an invalid result. No report was accepted; try again.") from None
        except GenerationError:
            raise
        except Exception:
            raise GenerationError("The request could not be completed. Please try again.") from None

    def analyze(self, resume: str, job: str, persona: str) -> Analysis:
        resume, job = validate_inputs(resume, job)
        return validate_grounding(self._parse(build_messages(resume, job, persona), Analysis), resume, job)

    def refine(self, resume: str, job: str, persona: str, original: str, draft: str, feedback: str) -> Revision:
        resume, job = validate_inputs(resume, job)
        feedback = validate_text(feedback, "Refinement feedback", MAX_FEEDBACK_CHARS, minimum=10)
        if not quote_in(original, resume):
            raise InputError("The selected original bullet no longer matches the resume. Analyze again.")
        result = self._parse(build_refinement_messages(resume, job, persona, original, draft, feedback), Revision)
        if result.original != original:
            raise GenerationError("The model changed the source bullet. No revision was accepted; try again.")
        validate_rewrite(result, resume)
        return result
