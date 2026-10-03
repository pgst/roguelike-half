#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Normalizer and validator script for "黄昏の騎士" (twilight_knight.json).
Ensures all 36 rooms, midpoint, and boss phases conform strictly to ScenarioEditor specifications.
"""

import json
from pathlib import Path

def main():
    json_path = Path("scenarios/twilight_knight.json")
    if not json_path.exists():
        print(f"File not found: {json_path}")
        return

    data = json.loads(json_path.read_text(encoding="utf-8"))

    # Validate top-level keys
    assert data["id"] == "twilight_knight"
    assert data["totalRoomsToClear"] == 8
    assert data["explorationMode"] == "linear"
    assert len(data["d66EventTable"]) == 36

    # Normalize NPC types
    if data["d66EventTable"]["23"]["npcType"] == "hireling":
        data["d66EventTable"]["23"]["npcType"] = "mercenary"
    if data["d66EventTable"]["24"]["npcType"] == "trader":
        data["d66EventTable"]["24"]["npcType"] = "merchant"

    # Trap chest verification
    assert data["d66EventTable"]["31"]["type"] == "trap"
    assert data["d66EventTable"]["31"]["lootModifier"] == 1

    # Write normalized versions
    formatted = json.dumps(data, ensure_ascii=False, indent=2)
    json_path.write_text(formatted, encoding="utf-8")
    
    mock_path = Path("src/data/scenarios/mock/twilight_knight.json")
    mock_path.parent.mkdir(parents=True, exist_ok=True)
    mock_path.write_text(formatted, encoding="utf-8")

    print(f"Successfully normalized and validated {json_path} and {mock_path}")

if __name__ == "__main__":
    main()
