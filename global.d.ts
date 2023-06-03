type BillingDocumentXML = {
    Invoice?: Attachment
    CreditNote?: Attachment
    AttachedDocument?: BillingDocument
}

type BillingDocument = {
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

type CreditNote = {}

type BillingDocumentEntity = {
    PartyTaxScheme: { CompanyID: string; RegistrationName: string }
}

type Attachment = {
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

type Billing = {
    id: string
    cufe: string
    date: string
    value: string | number
    proveedor: BillingEntity
    cliente: BillingEntity
}

type BillingEntity = {
    nit: string
    nombre: string
}
