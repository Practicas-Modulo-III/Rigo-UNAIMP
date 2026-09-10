from time import monotonic
class RamSemanticCache:
    def __init__(self): self._items: dict[str, tuple[float, object]] = {}
    def get(self, key: str, ttl_seconds: int = 300) -> object | None:
        value = self._items.get(key); return value[1] if value and monotonic() - value[0] <= ttl_seconds else None
    def set(self, key: str, value: object) -> None: self._items[key] = (monotonic(), value)
