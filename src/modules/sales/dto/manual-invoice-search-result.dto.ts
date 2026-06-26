export class ManualInvoiceSearchResultDto {
  id: string;
  invoiceNumber: string;
  customer: {
    identification: string;
    names: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  items: {
    codeReference: string;
    name: string;
    quantity: number;
    price: number;
    productId: string;
  }[];
  totalAmount: number;
}
