export class PaymentReceiptItemDto {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export class PaymentReceiptPaymentDto {
  id: string;
  amount: number;
  paymentDate: Date;
  notes: string | null;
  isCurrentPayment: boolean;
}

export class PaymentReceiptDto {
  // Payment info
  paymentId: string;
  paymentAmount: number;
  paymentDate: Date;
  paymentNotes: string | null;

  // Invoice info
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: string;
  invoiceTotal: number;
  invoiceSubtotal: number;
  invoiceDate: Date;
  invoiceItems: PaymentReceiptItemDto[];

  // Payment history
  allInvoicePayments: PaymentReceiptPaymentDto[];

  // Payment terms
  installments: number | null;
  paymentFrequency: string | null;
  dueDate: Date | null;

  // Computed
  remainingBalance: number;

  // Customer info
  customerId: string;
  customerName: string;
  customerDocument: string;
}
