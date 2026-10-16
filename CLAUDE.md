# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository.

## Azure Key Vault

Never read, list or enumerate Azure Key Vault secrets — no `az keyvault secret show`/`list`, no `SecretClient`, no portal scraping, and not even secret names or value lengths. If a task needs a secret value, ask the user to supply it or to run the command themselves.
