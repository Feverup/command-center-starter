# Command Center — shortcuts. Run `make` to list them.
#
# Hand-written and safe to edit. `.claude/scripts/setup/generate-makefile.sh`
# regenerates a minimal version of this file and deliberately refuses to
# overwrite an existing one unless you pass --force.

# Name for this assistant's isolated config. Change it if you run more than one.
NICK ?= command-center

# Google Workspace CLI credentials live in their own directory, so this
# assistant's auth never collides with another tool's. `make setup` creates it.
GWS_CONFIG_DIR ?= $(HOME)/.config/gws-$(NICK)

# The npm scope the sections are published under. `make update` moves every
# dependency in it to its newest release.
SCOPE ?= @asucregonzalez

.DEFAULT_GOAL := help
.PHONY: help install update update-template dev build start run setup verify-gws check-links clean

help: ## show this list
	@grep -hE '^[a-z][a-z-]*:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## install dependencies
	pnpm install

update: ## move the installed sections to their latest releases
	@.claude/scripts/update-sections.sh $(SCOPE)

update-template: ## fast-forward this clone's own files from where you cloned it
	@git rev-parse --git-dir >/dev/null 2>&1 || { echo "Not a git clone, so there is nothing to fast-forward. Copy the files you want from the template repo by hand."; exit 1; }
	@git remote get-url origin >/dev/null 2>&1 || { echo "No 'origin' remote — add one pointing at the template, or copy changes by hand."; exit 1; }
	@test -z "$$(git status --porcelain)" || { echo "You have uncommitted changes. Commit or stash them first — this pulls onto your working tree."; exit 1; }
	git pull --ff-only
	pnpm install

dev: ## run the dashboard — web on :5273, API on :4320
	pnpm dev

build: ## production build
	pnpm build

start: ## serve the production build
	pnpm start

run: ## launch Claude with this workspace's env (skills + isolated gws auth)
	GOOGLE_WORKSPACE_CLI_CONFIG_DIR=$(GWS_CONFIG_DIR) claude

setup: ## one-time bootstrap: isolated gws config dir + local settings
	.claude/scripts/setup/ensure-gws-config-dir.sh gws-$(NICK)
	.claude/scripts/setup/init-settings-local.sh

verify-gws: ## check the gws CLI is authenticated (prints the account)
	.claude/scripts/setup/verify-gws.sh $(GWS_CONFIG_DIR)

check-links: ## check markdown links (needs lychee: brew install lychee)
	lychee --offline --include-fragments './**/*.md'

clean: ## remove build output and dependencies
	rm -rf node_modules dist
