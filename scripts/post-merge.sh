#!/bin/bash
set -e

# This is a static HTML/CSS/JS site with no build step, package manager, or
# database migrations — nothing to install or generate after a merge. This
# script exists only so post-merge setup has a valid, fast, no-op target.
echo "No build step required for this static site."
