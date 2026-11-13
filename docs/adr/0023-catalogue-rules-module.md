title: '0023 Page types, colour sets and the audit log in one Medusa module',
};

# 0023 Page types, colour sets and the audit log in one Medusa module

**Status:** Accepted, 13 November 2026

## Context

[0005](/adr/0005-product-rules-in-medusa) put product rules in Medusa modules. PRD section 10 needs a page type and lead time on every product, reusable colour sets with a rule for when they apply, photos per size, finish and colour, and SKU rules. The team asked for a record of every change with a way to undo it, and for only some admin users to make changes.

## Decision

- One module, `catalogue_rules`, holds product profiles (page type, lead time, colour rule), colour sets and colours, colour images and audit entries. Products are referred to by id.
- Stock mode stays in Medusa's own two variant settings ([0014](/adr/0014-stock-modes)); the product screen sets it for every SKU of a product through Medusa's workflow, so variants that start tracking stock get an inventory item.
- Every change to a colour set or a product's settings goes through one workflow: check it, read the current state, write the new state, log both. The whole state before and after goes in the log, so restoring is writing the "before" back through the same workflow, and a failed step puts the "before" back on its own.
- Colours keep their ids when a set is edited or restored, because colour images point at them.
- A small role check: `metadata.talasey_role` on the admin user must be `owner` or `catalogue` to change anything. Medusa's own role-based access can replace it once it is switched on.
- SKU rules are plain functions, run over all products at once so duplicates across products are found.

## Consequences

- Admin users need the role set once (`grant-catalogue-role` script) before they can edit.
- The log grows with every change; at our editing rate that is fine for years.
- Switching a product to made to order drops its link to stock levels, as Medusa does. Restoring brings tracking back with an empty stock count.
- Restoring a product to "no page type" keeps its stock mode, since that lives on the SKUs.
