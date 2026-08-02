import type { RentalWithRelations } from './rentals.repository';

export function toRentalPublic(row: RentalWithRelations) {
  return {
    id: row.id,
    rentalNumber: row.rentalNumber,
    customerId: row.customerId,
    reservationId: row.reservationId,
    customer: row.customer
      ? {
          id: row.customer.id,
          customerNumber: row.customer.customerNumber,
          fullName: row.customer.fullName,
          status: row.customer.status,
        }
      : null,
    rentalDate: row.rentalDate,
    expectedReturnDate: row.expectedReturnDate,
    actualReturnDate: row.actualReturnDate,
    status: row.status,
    notes: row.notes,
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
