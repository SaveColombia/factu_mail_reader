import * as fs from 'node:fs/promises'
import { constants } from 'node:fs'
import { XMLParser } from 'fast-xml-parser'

export default class BillingParser {
    #log
    #parser

    /**
     * @param {import('pino').Logger} log
     */
    constructor(log) {
        this.#log = log
        this.#parser = new XMLParser({
            ignoreDeclaration: true,
            ignoreAttributes: true,
            parseAttributeValue: true,
            allowBooleanAttributes: true,
            removeNSPrefix: true,
            parseTagValue: true,
            trimValues: true,
            cdataPropName: '__cdata',
        })
    }

    /**
     * @param {AttachedDocument} document
     * @param {UBLDocument | null | undefined} ublDoc
     * @returns {string}
     */
    #extractID(document, ublDoc) {
        return (
            ublDoc?.ID ??
            (document.ParentDocumentID === 'null'
                ? null
                : document.ParentDocumentID ?? null) ??
            document.AltID ??
            document.ParentDocumentLineReference?.DocumentReference.ID ??
            document.ID ??
            ''
        )
    }

    /**
     *
     * @param {AttachedDocument} document
     * @return {string}
     */
    #extractCUFE(document) {
        return (
            document.UUID ??
            document.ParentDocumentLineReference?.DocumentReference?.UUID ??
            ''
        )
    }

    /**
     *
     * @param {BillingEntity|undefined} entity
     * @return {{nit: string, nombre: string}}
     */
    #extractEntityData(entity) {
        return {
            nit: entity?.PartyTaxScheme?.CompanyID ?? '',
            nombre: entity?.PartyTaxScheme?.RegistrationName ?? '',
        }
    }

    /**
     *
     * @param {AttachmentXML|UBLDocument} attachment
     * @returns {number}
     */
    #extractValueFromAttachment(attachment) {
        return (
            attachment.Invoice?.LegalMonetaryTotal?.PayableAmount ??
            attachment.CreditNote?.LegalMonetaryTotal?.PayableAmount ??
            attachment.DebitNote?.LegalMonetaryTotal?.PayableAmount ??
            attachment?.LegalMonetaryTotal?.PayableAmount ??
            0
        )
    }

    /**
     *
     * @param {AttachedDocument} document
     * @returns {AttachmentXML|UBLDocument}
     */
    #extractAttachment(document) {
        return this.#parser.parse(
            document.Attachment.ExternalReference.Description.__cdata
                .replace('<![CDATA[', '')
                .replace(']]', '')
        )
    }

    /**
     *
     * @param {AttachedDocument} attachedDocument
     * @returns {Billing}
     */
    #billingFromAttachedDocument(attachedDocument) {
        const attachment = this.#extractAttachment(attachedDocument)

        /** @type {UBLDocument|null} ublDoc */
        let ublDoc = null

        let type = 4

        if (attachment.ID) {
            ublDoc = attachment
        }

        if (attachment.Invoice) {
            ublDoc = attachment.Invoice
        }

        if (attachment.CreditNote) {
            ublDoc = attachment.CreditNote
            type = 5
        }

        if (attachment.DebitNote) {
            ublDoc = attachment.DebitNote
            type = 6
        }

        if (ublDoc) {
            let billing = this.#billingFromUblDocument(ublDoc, type)

            if (billing) {
                return billing
            }
        }

        return {
            id: ublDoc?.ID ?? this.#extractID(attachedDocument, ublDoc),
            cufe: ublDoc?.UUID ?? this.#extractCUFE(attachedDocument),
            date: ublDoc?.IssueDate ?? attachedDocument.IssueDate,
            value: this.#extractValueFromAttachment(attachment),
            proveedor: this.#extractEntityData(
                ublDoc?.AccountingSupplierParty?.Party ??
                    attachedDocument.SenderParty ??
                    attachedDocument.AccountingSupplierParty?.Party
            ),
            cliente: this.#extractEntityData(
                ublDoc?.AccountingCustomerParty?.Party ??
                    attachedDocument.ReceiverParty ??
                    attachedDocument.AccountingCustomerParty?.Party
            ),
            paymentDueDate: ublDoc?.PaymentMeans.PaymentDueDate ?? '',
            paymentMeanType: ublDoc?.PaymentMeans.ID ?? 1,
            billingType: type,
        }
    }

    /**
     * @param {UBLDocument} document
     * @param {BillingType} billingType
     * @returns {Billing}
     */
    #billingFromUblDocument(document, billingType) {
        if ((process.env.DEBUG ?? false) === 'true') {
            console.log(document)
        }

        return {
            id: document.ID,
            cufe: document.UUID,
            date: document.IssueDate,
            value: document.LegalMonetaryTotal.PayableAmount,
            proveedor: this.#extractEntityData(
                document.AccountingSupplierParty.Party
            ),
            cliente: this.#extractEntityData(
                document.AccountingCustomerParty.Party
            ),
            paymentMeanType: document?.PaymentMeans.ID,
            paymentDueDate:
                document?.PaymentMeans.ID === 2
                    ? document?.PaymentMeans.PaymentDueDate
                    : null,
            billingType: billingType,
        }
    }

    /**
     *
     * @param {string|Buffer} path
     * @returns {Promise<DocumentXML|null>}
     */
    async #parse(path) {
        const data = this.#parser.parse(await fs.readFile(path))

        if (!data) {
            return null
        }

        return data
    }

    /**
     *
     * @param {string} xmlPath
     * @returns {Promise<Billing|null>}
     * @throws {Error}
     */
    async #parseXML(xmlPath) {
        fs.access(xmlPath, constants.R_OK)

        const parsedXML = await this.#parse(xmlPath)

        if (!parsedXML) {
            throw new Error('El XML no pudo ser leido')
        }

        if (
            !(
                parsedXML.AttachedDocument ||
                parsedXML.Invoice ||
                parsedXML.CreditNote ||
                parsedXML.DebitNote
            )
        ) {
            throw new Error('El XML no contiene datos válidos')
        }

        try {
            if (parsedXML.Invoice) {
                console.log('Found an Invoice')
                this.#log.info('Found an Invoice')

                return this.#billingFromUblDocument(parsedXML.Invoice, 1)
            }

            if (parsedXML.CreditNote) {
                console.log('Found an CreditNote')
                this.#log.info('Found an CreditNote')

                return this.#billingFromUblDocument(parsedXML.CreditNote, 2)
            }

            if (parsedXML.DebitNote) {
                console.log('Found an DebitNote')
                this.#log.info('Found an DebitNote')

                return this.#billingFromUblDocument(parsedXML.DebitNote, 3)
            }

            if (parsedXML.AttachedDocument) {
                console.log('Found an AttachedDocument')
                this.#log.info('Found an AttachedDocument')

                return this.#billingFromAttachedDocument(
                    parsedXML.AttachedDocument
                )
            }
        } catch (e) {
            this.#log.error(e, 'Error al leer los datos de la factura')
            throw new Error('Error al leer los datos de la factura')
        }

        return null
    }

    /**
     * Parse a XML UBL document and try to extract a Billing
     *
     * @param {string} xmlPath
     * @returns {Promise<Billing|null>}
     */
    async parse(xmlPath) {
        const data = await this.#parseXML(xmlPath)

        if (!data.id) {
            throw new Error('La factura no tiene un ID')
        }

        return data
    }
}
