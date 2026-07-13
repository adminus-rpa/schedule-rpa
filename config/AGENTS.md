# Configuration Domain

## Purpose
Defines the YAML configuration schema and defaults for the application, controlling both backend behaviors (sync interval, db paths) and frontend visual characteristics (layout, groups per page).

## Ownership
- `config.yaml`: The single source of truth for runtime configurations.

## Local Contracts
- Any schema changes made in `config.yaml` must be reflected or gracefully handled by the `ConfigLoader` in `app/config_loader.py`.
- The frontend relies on the `display` section; removing or renaming keys will break `stores/config.svelte.ts`.

## Work Guidance
- Maintain comments and examples within the YAML to clarify the purpose of each key.
- Avoid introducing nested objects that overly complicate parsing unless logically necessary.

## Verification
- Run the backend application (`run.sh`) to ensure the configuration parser loads without `yaml.YAMLError` exceptions.

## Child DOX Index
This domain has no child directories requiring their own DOX files.
