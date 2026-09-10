def rerank_by_similarity(results: list[dict]) -> list[dict]:
    return sorted(results, key=lambda item: item.get("similarity", 0), reverse=True)
