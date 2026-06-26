export class CreditPortfolioResponseDto {
  creditLimit: number | null;
  currentBalance: number;
  availableCredit: number | null;
  utilizationPercent: number | null;
  creditStatus: string;
  paymentTermsDays: number;
}
