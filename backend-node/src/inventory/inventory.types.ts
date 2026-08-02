import type {
  Brand,
  Category,
  Color,
  Item,
  ItemBarcode,
  MediaFile,
  Prisma,
  Size,
} from '@prisma/client';
import type { PaginationInput } from '../shared/pagination/pagination';
import type { ItemMediaAttachment } from './items/items.repository';

export type TaxonomyKind = 'category' | 'brand' | 'color' | 'size';

export interface ListTaxonomyQuery extends PaginationInput {
  q?: string;
  deleted?: boolean | string;
  parentId?: string;
}

export interface TaxonomyPayload {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  parentId?: string | null;
  nameEn?: string | null;
  hexCode?: string | null;
}

export type TaxonomyCreateInput =
  | Prisma.CategoryUncheckedCreateInput
  | Prisma.BrandUncheckedCreateInput
  | Prisma.ColorUncheckedCreateInput
  | Prisma.SizeUncheckedCreateInput;
export type TaxonomyUpdateInput =
  | Prisma.CategoryUncheckedUpdateInput
  | Prisma.BrandUncheckedUpdateInput
  | Prisma.ColorUncheckedUpdateInput
  | Prisma.SizeUncheckedUpdateInput;
export type TaxonomyRow = Category | Brand | Color | Size;

export interface ListItemsQuery extends PaginationInput {
  q?: string;
  barcode?: string;
  categoryId?: string;
  brandId?: string;
  colorId?: string;
  sizeId?: string;
  status?: string;
  lifecycleState?: string;
  displayName?: string;
  internalCode?: string;
  deleted?: boolean | string;
  sortBy?: string;
  sortDir?: string;
}

export interface ItemPayload {
  displayName?: string;
  categoryId?: string;
  brandId?: string;
  colorId?: string;
  sizeId?: string;
  purchasePrice?: number;
  rentalPrice?: number;
  salePrice?: number;
  status?: string;
  condition?: string;
  description?: string;
  barcode?: string;
  generateBarcode?: boolean;
  /** Optional media bindings created atomically with the item (MediaReference only). */
  media?: Array<{
    mediaFileId: string;
    purpose?: string;
    isPrimary?: boolean;
    displayOrder?: number;
  }>;
}

export interface AttachItemMediaPayload {
  mediaFileId: string;
  purpose?: string;
  isPrimary?: boolean;
  displayOrder?: number;
}

export type ItemWithRelations = Item & {
  category: Category | null;
  brand: Brand | null;
  color: Color | null;
  size: Size | null;
  barcodes: (ItemBarcode & { barcode: { code: string } })[];
  media?: ItemMediaAttachment[];
};

export type { ItemMediaAttachment, MediaFile };
