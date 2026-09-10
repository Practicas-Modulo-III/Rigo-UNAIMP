import json
from collections.abc import AsyncIterator

import httpx

from app.config import Settings


class OllamaLLM:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def generate(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.settings.OLLAMA_BASE_URL}/api/generate",
                json={"model": self.settings.OLLAMA_CHAT_MODEL, "prompt": prompt, "stream": False},
            )
            response.raise_for_status()
        return response.json()["response"]

    async def stream_generate(self, prompt: str) -> AsyncIterator[str]:
        payload = {"model": self.settings.OLLAMA_CHAT_MODEL, "prompt": prompt, "stream": True}
        async with httpx.AsyncClient(timeout=90) as client:
            async with client.stream("POST", f"{self.settings.OLLAMA_BASE_URL}/api/generate", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        token = json.loads(line).get("response", "")
                        if token:
                            yield token


class GroqLLM:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def generate(self, prompt: str) -> str:
        if not self.settings.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not configured")
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.settings.GROQ_API_KEY}"},
                json={"model": self.settings.GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0.1},
            )
            response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

    async def stream_generate(self, prompt: str) -> AsyncIterator[str]:
        if not self.settings.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not configured")
        payload = {
            "model": self.settings.GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "stream": True,
        }
        headers = {"Authorization": f"Bearer {self.settings.GROQ_API_KEY}"}
        async with httpx.AsyncClient(timeout=90) as client:
            async with client.stream("POST", "https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line.removeprefix("data: ")
                    if data == "[DONE]":
                        return
                    token = json.loads(data)["choices"][0].get("delta", {}).get("content", "")
                    if token:
                        yield token


class DualModeLLM:
    """Groq in cloud mode; every cloud streaming failure falls back to Ollama."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.local = OllamaLLM(settings)
        self.cloud = GroqLLM(settings)

    async def generate(self, prompt: str) -> str:
        if not self.settings.MODO_DEMO_CLOUD:
            return await self.local.generate(prompt)
        try:
            return await self.cloud.generate(prompt)
        except Exception:
            return await self.local.generate(prompt)

    async def stream_generate(self, prompt: str) -> AsyncIterator[str]:
        if not self.settings.MODO_DEMO_CLOUD:
            async for token in self.local.stream_generate(prompt):
                yield token
            return
        try:
            async for token in self.cloud.stream_generate(prompt):
                yield token
        except Exception:
            async for token in self.local.stream_generate(prompt):
                yield token


def get_llm(settings: Settings) -> DualModeLLM:
    return DualModeLLM(settings)
