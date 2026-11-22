def inline_refs(schema: dict) -> dict:
    """Pydantic emits $defs/$ref for nested models. Inline them so the tool
    input_schema is one self-contained JSON schema."""
    defs = schema.get("$defs", {})

    def walk(node):
        if isinstance(node, dict):
            if "$ref" in node:
                name = node["$ref"].split("/")[-1]
                return walk(defs[name])
            return {k: walk(v) for k, v in node.items() if k != "$defs"}
        if isinstance(node, list):
            return [walk(v) for v in node]
        return node

    return walk(schema)
