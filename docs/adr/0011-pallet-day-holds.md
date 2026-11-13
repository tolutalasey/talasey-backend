title: '0011 Pallet days are held, then booked when the order is placed',
};

# 0011 Pallet days are held, then booked when the order is placed

**Status:** Accepted, 13 November 2026

## Context

Pallet deliveries go out on set days with limited room. A customer picks a day during checkout, but can take a while to pay or leave without buying. The services API can hold a day for a short time, book it, or release it. A booked day can't be released.

## Decision

Choosing a day holds it for the basket, and choosing another day releases the first hold. Before the order is placed, Medusa's checkout checks that the hold is still live, belongs to this basket and matches the delivery postcode, and that the access questions are answered. The day is booked by the `order.placed` subscriber, after the order exists. If the hold lapsed and the day filled up in the meantime, the order still stands and is marked for the team to rebook by phone.

## Consequences

- We never book a day for an order that failed, because booking only happens after the order is placed.
- A small window remains where the hold lapses during payment. The admin order page shows "Call to rebook" when that happens.
- The access answers (largest vehicle, hard standing, kerbside drop) are validated before the order and kept on it.
