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
     * @param {BillingDocument} document
     * @returns {string}
     */
    #extractID(document) {
        return (
            (document.ParentDocumentID == 'null' ? null : document.ParentDocumentID) ??
            document.AltID ??
            document.ParentDocumentLineReference?.DocumentReference.ID ??
            document.ID ??
            ''
        )
    }

    /**
     *
     * @param {BillingDocument} document
     * @return {string}
     */
    #extractCUFE(document) {
        return document.UUID ?? document.ParentDocumentLineReference?.DocumentReference?.UUID ?? ''
    }

    /**
     *
     * @param {BillingDocumentEntity|undefined} entity
     * @return {{nit: string, nombre: string}}
     */
    #extractEntityData(entity) {
        return {
            nit: entity?.PartyTaxScheme.CompanyID ?? entity?.PartyTaxScheme.CompanyID ?? '',
            nombre: entity?.PartyTaxScheme.RegistrationName ?? entity?.PartyTaxScheme.RegistrationName ?? '',
        }
    }

    /**
     *
     * @param {Partial<Attachment>} attachment
     * @returns {number}
     */
    #extractValue(attachment) {
        return (
            attachment.Invoice?.LegalMonetaryTotal?.PayableAmount ?? attachment?.LegalMonetaryTotal?.PayableAmount ?? 0
        )
    }

    /**
     *
     * @param {BillingDocument} document
     * @returns {Attachment}
     */
    #extractAttachment(document) {
        const xml = document.Attachment.ExternalReference.Description.__cdata.replace('<![CDATA[', '').replace(']]', '')
        return this.#parser.parse(xml)
    }

    /**
     *
     * @param {BillingDocument} document
     * @returns {Billing}
     */
    #extractBilling(document) {
        return {
            id: this.#extractID(document),
            cufe: this.#extractCUFE(document),
            date: document.IssueDate,
            value: this.#extractValue(this.#extractAttachment(document)),
            proveedor: this.#extractEntityData(document.SenderParty ?? document.AccountingSupplierParty?.Party),
            cliente: this.#extractEntityData(document.ReceiverParty ?? document.AccountingCustomerParty?.Party),
        }
    }

    /**
     *
     * @param {Attachment} document
     * @returns {Billing}
     */
    #extractAttachmentBilling(document) {
        return {
            id: document.ID,
            cufe: document.UUID,
            date: document.IssueDate,
            value: this.#extractValue(document),
            proveedor: this.#extractEntityData(document.AccountingSupplierParty.Party),
            cliente: this.#extractEntityData(document.AccountingCustomerParty.Party),
        }
    }

    /**
     *
     * @param {string} xmlPath
     * @returns {Promise<Billing|null>}
     */
    async #parseXML(xmlPath) {
        fs.access(xmlPath, constants.R_OK)

        /** @type {BillingDocumentXML} parserXML */
        const parsedXML = this.#parser.parse(await fs.readFile(xmlPath))

        if (!parsedXML) {
            throw new Error('XML could not be parsed')
        }

        if (!(parsedXML.Invoice || parsedXML.AttachedDocument || parsedXML.CreditNote)) {
            throw new Error('XML had no valid data')
        }

        if (parsedXML.Invoice) {
            console.log('Found an Invoice')
            this.#log.info('Found an Invoice')
            return this.#extractAttachmentBilling(parsedXML.Invoice)
        }

        if (parsedXML.CreditNote) {
            console.log('Found a Credit Note')
            this.#log.info('Found a Credit Note')
            return this.#extractAttachmentBilling(parsedXML.CreditNote)
        }

        if (parsedXML.AttachedDocument) {
            console.log('Found an AttachedDocument')
            this.#log.info('Found an AttachedDocument')
            return this.#extractBilling(parsedXML.AttachedDocument)
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
        return await this.#parseXML(xmlPath)
    }
}
