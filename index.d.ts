export interface BillingDocumentXML  {
    Invoice?: Attachment
    CreditNote?: Attachment
    AttachedDocument?: BillingDocument
}

export interface BillingDocument  {
    UUID?: string // CUFE
    ID?: string | null | 'null'
    AltID?: string | null | 'null'
    ParentDocumentID?: string | null | 'null'
    IssueDate: string
    Attachment: { ExternalReference: { Description: { __cdata: string } } }
    ParentDocumentLineReference?: {
        DocumentReference: {
            ID: string
            UUID: string //CUFE
            IssueDate: string
        }
    }
    // Proveedor
    SenderParty?: BillingDocumentEntity
    AccountingSupplierParty?: { Party: BillingDocumentEntity }

    // Empresa
    ReceiverParty?: BillingDocumentEntity
    AccountingCustomerParty?: { Party: BillingDocumentEntity }
}

export interface CreditNote  {}

export interface BillingDocumentEntity  {
    PartyTaxScheme: { CompanyID: string; RegistrationName: string }
}

export interface Attachment  {
    ID: string
    UUID: string
    IssueDate: string
    IssueTime: string
    DueDate: string
    AccountingSupplierParty: { Party: BillingDocumentEntity }
    AccountingCustomerParty: { Party: BillingDocumentEntity }
    LegalMonetaryTotal: {
        LineExtensionAmount: number
        TaxExclusiveAmount: number
        TaxInclusiveAmount: number
        AllowanceTotalAmount: number
        ChargeTotalAmount: number
        PrepaidAmount: number
        PayableAmount: number
    }
    Invoice?: Attachment
}

export interface Billing  {
    id: string
    cufe: string
    date: string
    value: string | number
    proveedor: BillingEntity
    cliente: BillingEntity
}

export interface BillingEntity  {
    nit: string
    nombre: string
}
