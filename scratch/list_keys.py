import yaml
import sys

with open('config/config.yaml', 'r') as f:
    config = yaml.safe_load(f)

def print_keys(d, prefix=''):
    for k, v in d.items():
        full_key = f"{prefix}{k}"
        print(full_key)
        if isinstance(v, dict):
            print_keys(v, full_key + '.')

print_keys(config)
