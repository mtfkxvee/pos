#!/bin/bash

# Rollback script for the margin_type/margin_rate_or_amount/rate_with_margin
# fix in pos_next/overrides/sales_invoice.py (CustomSalesInvoice.validate()).
#
# Background: this fix resets ERPNext's internal margin bookkeeping fields
# on every validate cycle, to stop a stale margin from a prior calculate_margin()
# pass silently inflating item.rate on invoices whose selling_price_list is
# not "Standard Selling" (e.g. Online Sales Import). See CHANGELOG for details.
#
# SAFE_POINT_COMMIT is the commit just BEFORE this fix was applied — i.e. the
# state to fall back to if the fix causes unexpected problems in production.
#
# Usage:
#   ./scripts/rollback-margin-fix.sh          # revert the fix commit locally + push
#   ./scripts/rollback-margin-fix.sh --check  # just print the commits involved, no changes

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info()    { echo -e "${BLUE}i${NC} $1"; }
print_success() { echo -e "${GREEN}v${NC} $1"; }
print_error()   { echo -e "${RED}x${NC} $1"; }
print_warning() { echo -e "${YELLOW}!${NC} $1"; }

# Filled in right after the fix is committed — do not edit by hand afterwards.
SAFE_POINT_COMMIT="867094965f2e9352d92daefcea1ad0d5134203ec"
FIX_COMMIT="3bd2030"
BRANCH="discountv2"

if [ "$SAFE_POINT_COMMIT" = "__SAFE_POINT_COMMIT__" ] || [ "$FIX_COMMIT" = "__FIX_COMMIT__" ]; then
    print_error "This script hasn't been filled in with real commit hashes yet."
    exit 1
fi

if [ "$1" = "--check" ]; then
    print_info "Safe point (before fix): $SAFE_POINT_COMMIT"
    print_info "Fix commit (to revert):  $FIX_COMMIT"
    echo
    git show --stat "$FIX_COMMIT"
    exit 0
fi

print_warning "This will revert commit $FIX_COMMIT on branch $BRANCH and push the revert."
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Rollback cancelled"
    exit 0
fi

print_info "Reverting $FIX_COMMIT..."
git revert --no-edit "$FIX_COMMIT"
print_success "Revert commit created locally"

print_info "Pushing to origin/$BRANCH..."
git push origin "$BRANCH"
print_success "Pushed"

echo
echo "========================================"
print_warning "Now deploy the revert on the server:"
echo "========================================"
cat <<'EOF'
  cd /home/lthv/frappe-bench
  git -C apps/pos_next pull upstream discountv2
  bench --site erp.x-sha.id migrate
  # Backend-only change (overrides/sales_invoice.py) — no frontend build needed
  sudo supervisorctl restart all
EOF
