import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Represents a single item in a sales note (credit/debit) request.
 * Items are reused across all scenarios (credit: D; debit: E, F), with optional fields
 * used or ignored depending on the scenario context.
 */
export class CreateSalesNoteItemDto {
  /** Product SKU, EAN, or internal code reference (required for matching against invoice items). */
  @IsString()
  @IsNotEmpty({ message: 'El código de referencia es obligatorio' })
  codeReference: string;

  /** Item quantity (required). */
  @IsNumber()
  @IsNotEmpty({ message: 'La cantidad es obligatoria' })
  quantity: number;

  /**
   * Adjusted unit price for this item.
   * Required for scenario F (undercharge — debit notes only).
   * For scenario D (total annulment), the original invoice price is used.
   */
  @IsNumber()
  @IsOptional()
  price?: number;

  /**
   * Product UUID (foreign key to Product entity).
   * Optional because some scenarios operate without inventory impact (e.g., Scenario E — financial interest).
   * REQUIRED for scenarios that affect inventory:
   *   - Scenario D (total annulment): restoreStock needs productId per item
   * When omitted for inventory-impact scenarios, the handler throws BadRequestException.
   */
  @IsString()
  @IsOptional()
  productId?: string;

  /**
   * Maps to the DIAN correctionConceptCode that determines which scenario handler is invoked.
   * For credit notes: '2' → D (total annulment)
   * This field is informational; the actual routing happens via `CreateSalesNoteDto.correctionConceptCode`.
   */
  @IsString()
  @IsOptional()
  scenarioType?: string;
}

export class CreateSalesNoteDto {
  @IsString()
  @IsNotEmpty({ message: 'El concepto de corrección es obligatorio' })
  correctionConceptCode: string;

  @IsString()
  @IsOptional()
  observation?: string;

  @IsString()
  @IsOptional()
  billNumber?: string;

  @IsNumber()
  @IsOptional()
  numberingRangeId?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesNoteItemDto)
  items?: CreateSalesNoteItemDto[];

  /**
   * Human-readable scenario type for debugging/logging.
   * Derived from correctionConceptCode. Not used for routing (that happens via correctionConceptCode).
   */
  @IsString()
  @IsOptional()
  scenarioType?: string;
}
