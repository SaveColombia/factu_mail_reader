interface DocumentXML {
    Invoice?: Invoice
    CreditNote?: CreditNote
    DebitNote?: DebitNote
    AttachedDocument?: AttachedDocument
}

declare type AttachmentXML = Omit<DocumentXML, 'AttachedDocument'>

interface BillingEntity {
    PartyTaxScheme: {
        CompanyID: string
        RegistrationName: string
    }
}

interface AttachedDocument {
    UUID?: string // CUFE
    ID?: string | null | 'null'
    ParentDocumentID?: string | null | 'null'
    IssueDate: string
    IssueTime: string
    // Proveedor
    SenderParty?: BillingEntity
    AccountingSupplierParty?: { Party: BillingEntity }

    // Empresa
    ReceiverParty?: BillingEntity
    AccountingCustomerParty?: { Party: BillingEntity }

    // Not Standard
    AltID?: string | null | 'null'
    Attachment: { ExternalReference: { Description: { __cdata: string } } }
    ParentDocumentLineReference?: {
        DocumentReference: {
            ID: string
            UUID: string //CUFE
            IssueDate: string
        }
    }
}

interface UBLDocument {
    UUID: string
    ID: string

    IssueDate: string
    IssueTime: string

    AccountingSupplierParty: { Party: BillingEntity }
    AccountingCustomerParty: { Party: BillingEntity }
    TaxTotal?: InvoiceTaxTotal | Array<InvoiceTaxSubtotal>
    LegalMonetaryTotal: {
        LineExtensionAmount: number
        TaxExclusiveAmount: number
        TaxInclusiveAmount: number
        AllowanceTotalAmount: number
        ChargeTotalAmount?: number
        PrepaidAmount: number
        PayableRoundingAmount: number
        PayableAmount: number
    }
    PaymentMeans: {
        ID?: number
        PaymentDueDate?: string
    }
}

interface Invoice extends UBLDocument {}

interface CreditNote extends UBLDocument {
    CreditNoteLine: CreditNoteLine | Array<CreditNoteLine>
}

interface DebitNote extends UBLDocument {
    DebitNoteLine: DebitNoteLine | Array<DebitNoteLine>
}

interface CreditNoteLine {
    ID: number
    Note?: string
    CreditedQuantity?: number
}

interface DebitNoteLine {
    ID: number
    Note?: string
    DebitedQuantity?: number
}

interface InvoiceTaxTotal {
    TaxAmount: number
    TaxSubtotal: InvoiceTaxSubtotal | Array<InvoiceTaxSubtotal>
}

interface InvoiceTaxSubtotal {
    TaxableAmount: number
    TaxAmount: number
    Percent: number
}

interface Billing {
    id: string
    cufe: string
    date: string
    value: string | number
    proveedor: BillingEntity
    cliente: BillingEntity
    billingType: BillingType
    paymentMeanType: PaymentMeansType
    paymentDueDate: string
}

interface BillingEntity {
    nit: string
    nombre: string
}

declare enum PaymentMeansType {
    Contado = 1,
    Credito = 2,
}

declare enum BillingType {
    Invoice = 1,
    CreditNote = 2,
    DebitNote = 3,
    AttachedDocumentInvoice = 4,
    AttachedDocumentCreditNote = 5,
    AttachedDocumentDebitNote = 6,
}
