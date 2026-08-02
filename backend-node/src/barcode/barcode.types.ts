import type { BarcodeType } from './barcode.constants';

export interface BarcodeFormatOptions {
  readonly prefix?: string;
  readonly separator?: string;
  readonly padding?: number;
}

export interface GenerateBarcodeInput {
  readonly type?: BarcodeType;
  readonly overrides?: BarcodeFormatOptions;
  readonly createdBy?: string | null;
}

export interface ReserveBarcodeInput {
  readonly value?: string;
  readonly type?: BarcodeType;
  readonly overrides?: BarcodeFormatOptions;
  readonly createdBy?: string | null;
}

export interface ListBarcodesInput {
  readonly q?: string;
  readonly prefix?: string;
  readonly status?: string;
  readonly type?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly sortBy?: string;
  readonly sortDir?: 'asc' | 'desc';
  readonly offset?: number;
  readonly limit?: number;
}
