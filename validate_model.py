#!/usr/bin/env python3
"""
Verify that the fixed model.json is valid and readable
"""

import json
from pathlib import Path

def validate_model():
    model_path = Path('public/model/model.json')
    
    print(f"📋 Validating: {model_path}")
    print("=" * 60)
    
    with open(model_path, 'r') as f:
        model = json.load(f)
    
    # Check format
    fmt = model.get('format')
    print(f"✓ Format: {fmt}")
    
    # Check model topology
    if 'modelTopology' in model:
        topo = model['modelTopology']
        print(f"✓ Model topology present")
        
        if 'config' in topo:
            config = topo['config']
            layers = config.get('layers', [])
            print(f"✓ Number of layers: {len(layers)}")
            
            # Check for batch_shape (should be gone)
            has_batch_shape = False
            has_batch_input_shape = False
            
            def check_config(obj, path=""):
                nonlocal has_batch_shape, has_batch_input_shape
                if isinstance(obj, dict):
                    if 'batch_shape' in obj:
                        has_batch_shape = True
                        print(f"  ⚠️  Found batch_shape at {path}: {obj['batch_shape']}")
                    if 'batch_input_shape' in obj:
                        has_batch_input_shape = True
                        print(f"  ✓ Found batch_input_shape at {path}: {obj['batch_input_shape']}")
                    
                    for key, value in obj.items():
                        check_config(value, f"{path}.{key}")
                elif isinstance(obj, list):
                    for i, item in enumerate(obj):
                        check_config(item, f"{path}[{i}]")
            
            print("\n📝 Checking for batch_shape/batch_input_shape:")
            check_config(topo)
            
            if has_batch_shape:
                print("❌ ERROR: Still has batch_shape properties!")
                return False
            elif has_batch_input_shape:
                print("✅ Good: All batch_shape converted to batch_input_shape")
            else:
                print("⚠️  Warning: No batch_input_shape found")
    
    # Check weights manifest
    weights = model.get('weightsManifest', [])
    print(f"\n✓ Weights manifest entries: {len(weights)}")
    for i, entry in enumerate(weights):
        print(f"  Entry {i}: {len(entry.get('weights', []))} weight groups")
    
    # Check weights files
    print(f"\n✓ Checking weight files:")
    for entry in weights:
        for weight_group in entry.get('weights', []):
            path = weight_group.get('path')
            if path:
                weight_path = Path('public/model') / path
                if weight_path.exists():
                    size = weight_path.stat().st_size
                    print(f"  ✓ {path}: {size / 1024 / 1024:.2f} MB")
                else:
                    print(f"  ❌ MISSING: {path}")
                    return False
    
    print("\n" + "=" * 60)
    print("✅ Model validation successful!")
    return True

if __name__ == '__main__':
    import sys
    success = validate_model()
    sys.exit(0 if success else 1)
