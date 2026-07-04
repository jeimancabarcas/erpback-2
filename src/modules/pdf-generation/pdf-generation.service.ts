import { Injectable } from '@nestjs/common';

const PDFDocument = require('pdfkit');
import { Invoice } from '../sales/entities/invoice.entity';
import { CreditNote } from '../sales/entities/credit-note.entity';

@Injectable()
export class PdfGenerationService {
  generateInvoicePdf(
    invoice: Invoice,
    creditNotes: CreditNote[],
    compress = true,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc: PDFKit.PDFDocument = new PDFDocument({
        margin: 50,
        size: 'A4',
        compress,
      });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer.toString('base64'));
      });
      doc.on('error', reject);

      this.buildHeader(doc, invoice);
      this.buildItemsTable(doc, invoice);
      this.buildAppliedNotesSection(doc, creditNotes);
      this.buildNetBalance(doc, invoice, creditNotes);

      doc.end();
    });
  }

  private formatCurrency(amount: number): string {
    return (
      '$' +
      Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private buildHeader(doc: PDFKit.PDFDocument, invoice: Invoice): void {
    const prefix = invoice.emission ? 'FAC' : 'MAN';
    const invNumber = `${prefix}-${String(invoice.sequentialNumber).padStart(6, '0')}`;
    doc.fontSize(18).font('Helvetica-Bold');
    doc.text(`Historial de Factura ${invNumber}`, {
      align: 'center',
    });

    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Fecha de emisión: ${this.formatDate(invoice.date)}`, {
      align: 'center',
    });

    if (invoice.customer) {
      doc.moveDown(0.3);
      doc.text(
        `Cliente: ${invoice.customer.name || 'N/A'}  |  ${invoice.customer.documentType || 'Doc'}: ${invoice.customer.documentNumber || 'N/A'}`,
        { align: 'center' },
      );
    }

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);
  }

  private buildItemsTable(doc: PDFKit.PDFDocument, invoice: Invoice): void {
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Productos / Servicios', { underline: false });
    doc.moveDown(0.3);

    const tableTop = doc.y;
    const colX = [50, 200, 300, 400, 480];
    const colWidths = [150, 100, 100, 80, 65];

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Producto', colX[0], tableTop, { width: colWidths[0] });
    doc.text('Cantidad', colX[1], tableTop, {
      width: colWidths[1],
      align: 'center',
    });
    doc.text('Precio Unit.', colX[2], tableTop, {
      width: colWidths[2],
      align: 'center',
    });
    doc.text('Subtotal', colX[3], tableTop, {
      width: colWidths[3],
      align: 'right',
    });

    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
    doc.moveDown(0.2);

    const items = invoice.items || [];
    doc.fontSize(9).font('Helvetica');

    for (const item of items) {
      const rowY = doc.y;
      const name = item.product?.name || 'Producto';
      const truncatedName =
        name.length > 30 ? name.substring(0, 27) + '...' : name;

      if (rowY > 700) {
        doc.addPage();
        doc.y = 50;
      }

      doc.text(truncatedName, colX[0], doc.y, { width: colWidths[0] });
      doc.text(
        String(item.quantity),
        colX[1],
        doc.y - doc.currentLineHeight(),
        { width: colWidths[1], align: 'center' },
      );
      doc.text(
        this.formatCurrency(Number(item.product?.sellingPrice || 0)),
        colX[2],
        doc.y - doc.currentLineHeight(),
        { width: colWidths[2], align: 'center' },
      );
      doc.text(
        this.formatCurrency(Number(item.quantity) * Number(item.product?.sellingPrice || 0)),
        colX[3],
        doc.y - doc.currentLineHeight(),
        { width: colWidths[3], align: 'right' },
      );
      doc.moveDown(0.3);
    }

    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold');
    const totalAmount = (invoice.items ?? []).reduce(
      (acc, item) => acc + Number(item.quantity) * Number(item.product?.sellingPrice || 0),
      0,
    );
    doc.text('Total', colX[2], doc.y, { width: colWidths[2], align: 'center' });
    doc.text(
      this.formatCurrency(totalAmount),
      colX[3],
      doc.y - doc.currentLineHeight(),
      { width: colWidths[3], align: 'right' },
    );

    doc.moveDown(1.5);
  }

  private buildAppliedNotesSection(
    doc: PDFKit.PDFDocument,
    creditNotes: CreditNote[],
  ): void {
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Notas de Ajuste Aplicadas');
    doc.moveDown(0.5);

    if (creditNotes.length === 0) {
      doc.fontSize(10).font('Helvetica');
      doc.text('No se han aplicado notas de ajuste');
      doc.moveDown(1.5);
      return;
    }

    const colX = [50, 170, 270, 370, 470];
    doc.fontSize(9).font('Helvetica-Bold');
    const headerY = doc.y;
    doc.text('Nota', colX[0], headerY, { width: 120 });
    doc.text('Fecha', colX[1], headerY, { width: 100 });
    doc.text('Concepto', colX[2], headerY, { width: 100 });
    doc.text('Valor', colX[3], headerY, { width: 100, align: 'right' });

    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
    doc.moveDown(0.2);

    for (const note of creditNotes) {
      const rowY = doc.y;

      if (rowY > 700) {
        doc.addPage();
        doc.y = 50;
      }

      const noteNumber = note.noteNumber || note.referenceCode || 'N/A';
      const dateStr = this.formatDate(note.createdAt);
      const concept = (note as any).correctionConceptCode || 'N/A';
      const amount = Number(note.amount);
      const formattedAmount = this.formatCurrency(amount);
      const amountLabel = `-${formattedAmount}`;

      doc.font('Helvetica').fontSize(9);
      doc.text(noteNumber, colX[0], rowY, { width: 120 });
      doc.text(dateStr, colX[1], rowY, { width: 100 });
      doc.text(concept, colX[2], rowY, { width: 100 });
      doc.font('Helvetica-Bold');
      doc.text(amountLabel, colX[3], rowY, { width: 100, align: 'right' });

      if (note.observation) {
        doc.moveDown(0.1);
        doc.font('Helvetica').fontSize(8).fillColor('#666666');
        doc.text(note.observation, colX[0], doc.y, { width: 400 });
        doc.fillColor('#000000');
      }

      doc.moveDown(0.5);
    }

    doc.moveDown(0.5);
  }

  private buildNetBalance(
    doc: PDFKit.PDFDocument,
    invoice: Invoice,
    creditNotes: CreditNote[],
  ): void {
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    const originalTotal = (invoice.items ?? []).reduce(
      (acc, item) => acc + Number(item.quantity) * Number(item.product?.sellingPrice || 0),
      0,
    );
    const creditsTotal = creditNotes.reduce(
      (sum, cn) => sum + Number(cn.amount),
      0,
    );
    const currentBalance = originalTotal - creditsTotal;

    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Original: ${this.formatCurrency(originalTotal)}`);
    doc.text(`Créditos: -${this.formatCurrency(creditsTotal)}`);

    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(
      `${this.formatCurrency(originalTotal)} - ${this.formatCurrency(creditsTotal)} = ${this.formatCurrency(currentBalance)}`,
    );

    doc.moveDown(1);
    doc.fontSize(8).font('Helvetica').fillColor('#999999');
    doc.text(`Documento generado el: ${this.formatDate(new Date())}`, {
      align: 'center',
    });
    doc.fillColor('#000000');
  }
}
