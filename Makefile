# ─────────────────────────────────────────────────────────────────────────────
# Jeevandata — developer task runner
#
# Thin wrappers over the scripts/ helpers. Run:  make help
# (make is bundled with Git for Windows / MSYS2 and preinstalled on macOS and
# every Linux/CI runner.)
# ─────────────────────────────────────────────────────────────────────────────

SHELL := /bin/bash

.PHONY: help validate-secrets secrets-check secrets-test

## help: list available targets
help:
	@echo 'Targets:'
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //' | sort

## validate-secrets: run the validator test suite and check the real .env
validate-secrets: secrets-test secrets-check
	@echo 'ok: all secrets checks passed'

## secrets-test: automated 10-check harness for validate-secrets.sh
secrets-test:
	@bash scripts/test-validate-secrets.sh

## secrets-check: validate apps/backend/.env in local mode (skips if absent)
secrets-check:
	@if [ -f apps/backend/.env ]; then \
		bash scripts/validate-secrets.sh --env local --file apps/backend/.env; \
	else \
		echo 'skip: apps/backend/.env not present'; \
	fi
