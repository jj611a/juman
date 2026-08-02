import type { ReservationWithRelations } from './reservations.repository';

export function toReservationPublic(row: ReservationWithRelations) {
  return {
    id: row.id,
    reservationNumber: row.reservationNumber,
    customerId: row.customerId,
    customer: row.customer
      ? {
          id: row.customer.id,
          customerNumber: row.customer.customerNumber,
          fullName: row.customer.fullName,
          status: row.customer.status,
        }
      : null,
    startDate: row.startDate,
    expectedCheckoutDate: row.expectedCheckoutDate,
    expectedReturnDate: row.expectedReturnDate,
    status: row.status,
    notes: row.notes,
    rental: row.rental
      ? {
          id: row.rental.id,
          rentalNumber: row.rental.rentalNumber,
          status: row.rental.status,
        }
      : null,
    items: row.items.map((i) => ({
      id: i.id,
      itemId: i.itemId,
      barcodeValue: i.barcodeValue,
      agreedRentalPrice: i.agreedRentalPrice,
      notes: i.notes,
      item: i.item
        ? {
            id: i.item.id,
            internalCode: i.item.internalCode,
            displayName: i.item.displayName,
            status: i.item.status,
            lifecycleState: i.item.lifecycleState,
            rentalPrice: i.item.rentalPrice,
          }
        : null,
    })),
    statusHistory: row.statusHistory.map((h) => ({
      id: h.id,
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      reason: h.reason,
      userId: h.userId,
      username: h.username,
      createdAt: h.createdAt,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  };
}
