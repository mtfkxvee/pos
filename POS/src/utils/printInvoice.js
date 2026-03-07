import { call } from "@/utils/apiWrapper"
import { logger } from "@/utils/logger"
import { formatCurrency } from "@/utils/currency"

const log = logger.create("PrintInvoice")

/**
 * Print invoice using Frappe's print format system
 * @param {Object} invoiceData - The invoice document data
 * @param {string} printFormat - The print format name (optional)
 * @param {string} letterhead - The letterhead name (optional)
 * @note Use "POS Next Receipt" format for thermal printer (80mm) or configure via POS Profile
 */
export async function printInvoice(
	invoiceData,
	printFormat = null,
	letterhead = null,
) {
	try {
		if (!invoiceData || !invoiceData.name) {
			throw new Error("Invalid invoice data")
		}

		const doctype = invoiceData.doctype || "Sales Invoice"
		const format = printFormat || "POS Next Receipt"

		// Build PDF print URL
		const params = new URLSearchParams({
			doctype: doctype,
			name: invoiceData.name,
			format: format,
			no_letterhead: letterhead ? 0 : 1,
			_lang: "en",
			trigger_print: 1,
			_t: Date.now(), // Cache buster to force fresh print format
		})

		if (letterhead) {
			params.append("letterhead", letterhead)
		}

		// Open PDF in new window - browser will handle print dialog
		const printUrl = `/printview?${params.toString()}`
		const printWindow = window.open(printUrl, "_blank", "width=800,height=600")

		if (!printWindow) {
			throw new Error(
				"Failed to open print window. Please check your popup blocker settings.",
			)
		}

		return true
	} catch (error) {
		log.error("Error printing with Frappe print format:", error)
		// Fallback to custom print format
		return printInvoiceCustom(invoiceData, format)
	}
}

/**
 * Generates and prints a custom POS receipt using a thermal printer layout.
 *
 * This fallback printer is used when Frappe's standard print format is unavailable.
 * The receipt is optimized for 80mm thermal printers with clean, readable formatting.
 *
 * Receipt Structure:
 * - Header: Company name and invoice type
 * - Info: Invoice number, date, customer, payment status
 * - Items: Each item shows quantity × original price = subtotal
 * - Discounts: Displayed as separate line items with negative amounts
 * - Totals: Subtotal, tax, and grand total
 * - Payments: Payment methods and amounts, change, outstanding balance
 * - Footer: Thank you message and branding
 *
 * @param {Object} invoiceData - The invoice document data from ERPNext
 * @param {string} invoiceData.name - Invoice number
 * @param {string} invoiceData.company - Company name
 * @param {Array} invoiceData.items - Invoice line items
 * @param {Array} invoiceData.payments - Payment records
 * @param {Array} invoiceData.payments - Payment records
 * @param {number} invoiceData.grand_total - Invoice total amount
 * @param {string} printFormat - The requested print format (e.g., "58 PRINTER" or "80 PRINTER")
 */
export function printInvoiceCustom(invoiceData, printFormat = "80 PRINTER") {
	const is58mm = printFormat && printFormat.includes("58")
	const widthCSS = is58mm ? "57mm" : "80mm"
	const windowWidth = is58mm ? "220" : "350"

	// Determine Date and Time intelligently (Extract from OFFLINE ID if present)
	let docDateStr = new Date(
		invoiceData.posting_date || Date.now(),
	).toLocaleDateString()
	let docTimeStr = invoiceData.posting_time || new Date().toLocaleTimeString()

	if (invoiceData.name && invoiceData.name.startsWith("OFFLINE-")) {
		const parts = invoiceData.name.split("-")
		if (parts.length > 1) {
			const timestamp = Number.parseInt(parts[1], 10)
			if (!isNaN(timestamp)) {
				const dateObj = new Date(timestamp)
				docDateStr = dateObj.toLocaleDateString()
				docTimeStr = dateObj.toLocaleTimeString()
			}
		}
	}

	// Open print window with receipt size dimensions
	const printWindow = window.open(
		"",
		"_blank",
		`width=${windowWidth},height=600`,
	)

	const printContent = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<title>${__("Invoice - {0}", [invoiceData.name])}</title>
			<style>
				@page {
					size: ${widthCSS} auto;
					margin: 0mm;
				}
				.print-format table, .print-format tr,
				.print-format td, .print-format div, .print-format p {
					line-height: 1.4;
					vertical-align: middle;
				}
				body, .print-format {
					font-family: 'DejaVu Sans', 'Arial', sans-serif;
					width: ${widthCSS};
					max-width: ${widthCSS};
					margin: 0 auto;
					padding: 5px 9px;
					font-size: 9px;
					box-sizing: border-box;
					color: black;
				}
				.text-center { text-align: center; }
				.text-right { text-align: right; }
				p { margin: 0 0 4px 0; }
				hr {
					border: none;
					border-top: 1px dashed #333;
					margin: 6px 0;
				}
				table {
					width: 100%;
					border-collapse: collapse;
					font-size: 9px;
				}
				table.table-condensed td,
				table.table-condensed th {
					padding: 2px 1px;
					vertical-align: top;
				}
				table.table-condensed thead th {
					border-bottom: 1px solid #333;
					font-weight: bold;
					font-size: 8.5px;
				}
				table.table-condensed tbody tr:not(:last-child) td {
					border-bottom: 1px dotted #ccc;
				}
				table.no-border td {
					border: none !important;
				}
				.grand-total-row td {
					font-size: 11px;
					font-weight: bold;
					border-top: 2px solid #000;
					padding-top: 4px;
				}
				.paid-row td { font-weight: bold; }
				.change-row td { font-weight: bold; color: #28a745; }
				
				@media print {
					body, .print-format { padding: 2mm 3mm; }
					.no-print { display: none; }
				}
			</style>
		</head>
		<body class="print-format">
			<!-- HEADER -->
			<p class="text-center" style="margin-bottom: 6px;">
				<b style="font-size: 13px;">X-SHA</b><br>
				<span style="font-size: 9px; letter-spacing: 1px;">INVOICE</span>
			</p>

			<!-- INFO -->
			<p style="font-size: 8.5px; line-height: 1.7;">
				<b>No &nbsp;:</b> ${invoiceData.name}<br>
				<b>Kasir:</b> ${invoiceData.owner || "Administrator"}<br>
				<b>Plg &nbsp;:</b> ${invoiceData.customer_name || invoiceData.customer || "Guest"}<br>
				<b>Tgl &nbsp;:</b> ${docDateStr}<br>
				<b>Jam &nbsp;:</b> ${docTimeStr}<br>
			</p>

			<hr>

			<!-- ITEMS TABLE -->
			<table class="table table-condensed">
				<thead>
					<tr>
						<th width="48%">${__("Item")}</th>
						<th width="20%" class="text-right">${__("Qty")}</th>
						<th width="32%" class="text-right">${__("Amount")}</th>
					</tr>
				</thead>
				<tbody>
					${invoiceData.items
						.map((item) => {
							const qty = item.quantity || item.qty
							const displayRate = item.price_list_rate || item.rate
							const subtotal = qty * displayRate
							const isFree = item.is_free_item

							return `
						<tr>
							<td>
								${item.item_code} ${isFree ? __("(FREE)") : ""}
								${item.item_name && item.item_name !== item.item_code ? `<br><span style="font-size:8px; color:#555;">${item.item_name}</span>` : ""}
								${item.serial_no ? `<br><span style="font-size:7.5px;"><b>S/N:</b> ${item.serial_no.replace(/\n/g, ", ")}</span>` : ""}
							</td>
							<td class="text-right">
								${qty}<br>
								<span style="font-size:8px; color:#555;">@${formatCurrency(displayRate, "IDR", "id-ID")}</span>
							</td>
							<td class="text-right">${formatCurrency(subtotal, "IDR", "id-ID")}</td>
						</tr>
						`
						})
						.join("")}
				</tbody>
			</table>

			<hr>

			<!-- TOTALS TABLE -->
			<table class="table table-condensed no-border">
				<tbody>
					<!-- Subtotal / Total -->
					<tr>
						${
							invoiceData.total_taxes_and_charges &&
							invoiceData.total_taxes_and_charges > 0
								? `
						<td class="text-right" style="width:62%;">${__("Total Excl. Tax")}</td>
						<td class="text-right">${formatCurrency((invoiceData.grand_total || 0) - (invoiceData.total_taxes_and_charges || 0), "IDR", "id-ID")}</td>
						`
								: `
						<td class="text-right" style="width:62%;">${__("Subtotal")}</td>
						<td class="text-right">${formatCurrency(invoiceData.grand_total, "IDR", "id-ID")}</td>
						`
						}
					</tr>

					<!-- Taxes -->
					${(invoiceData.taxes || [])
						.map(
							(row) => `
					<tr>
						<td class="text-right" style="width:62%; color:#555; font-size:8.5px;">
							${row.description.includes("%") ? row.description : `${row.description}@${row.rate}%`}
						</td>
						<td class="text-right" style="color:#555; font-size:8.5px;">${formatCurrency(row.tax_amount, "IDR", "id-ID")}</td>
					</tr>
					`,
						)
						.join("")}

					<!-- Discount -->
					${
						invoiceData.discount_amount
							? `
					<tr>
						<td class="text-right" style="width:62%; color:#28a745;">${__("Discount")} ${invoiceData.additional_discount_percentage ? `(${Number(invoiceData.additional_discount_percentage).toFixed(1)}%)` : ""}</td>
						<td class="text-right" style="color:#28a745;">-${formatCurrency(Math.abs(invoiceData.discount_amount), "IDR", "id-ID")}</td>
					</tr>
					`
							: ""
					}

					<!-- Grand Total -->
					<tr class="grand-total-row">
						<td class="text-right" style="width:62%;"><b>${__("Grand Total")}</b></td>
						<td class="text-right"><b>${formatCurrency(invoiceData.grand_total, "IDR", "id-ID")}</b></td>
					</tr>

					<!-- Payment Methods -->
					${(invoiceData.payments || [])
						.map(
							(row) => `
					<tr>
						<td class="text-right" style="width:62%; font-size:8.5px;">${row.mode_of_payment}:</td>
						<td class="text-right" style="font-size:8.5px;">${formatCurrency(row.amount, "IDR", "id-ID")}</td>
					</tr>
					`,
						)
						.join("")}

					<!-- Paid Amount -->
					<tr class="paid-row" style="border-top:1px solid #ccc;">
						<td class="text-right" style="width:62%; padding-top:4px;"><b>${__("Paid Amount")}</b></td>
						<td class="text-right" style="padding-top:4px;"><b>${formatCurrency(invoiceData.paid_amount || 0, "IDR", "id-ID")}</b></td>
					</tr>

					<!-- Change Amount -->
					${
						invoiceData.change_amount && invoiceData.change_amount > 0
							? `
					<tr class="change-row">
						<td class="text-right" style="width:62%;"><b>${__("Change Amount")}</b></td>
						<td class="text-right"><b>${formatCurrency(invoiceData.change_amount, "IDR", "id-ID")}</b></td>
					</tr>
					`
							: ""
					}

					<!-- Outstanding -->
					${
						invoiceData.outstanding_amount && invoiceData.outstanding_amount > 0
							? `
					<tr>
						<td class="text-right" style="width:62%; color:#dc3545; font-weight:bold; background:#fff3cd; padding:3px 4px;">
							${__("Balance Due")}
						</td>
						<td class="text-right" style="color:#dc3545; font-weight:bold; background:#fff3cd; padding:3px 4px;">
							${formatCurrency(invoiceData.outstanding_amount, "IDR", "id-ID")}
						</td>
					</tr>
					`
							: ""
					}
				</tbody>
			</table>

			<hr>

			<!-- TERMS & FOOTER -->
			<p class="text-center" style="font-size:9px; margin-top:5px;">${__("Thank you, please visit again.")}</p>

			<div class="no-print" style="text-align: center; margin-top: 20px;">
				<button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">
					${__("Print Receipt")}
				</button>
				<button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; margin-left: 10px;">
					${__("Close")}
				</button>
			</div>
		</body>
		</html>
	`

	printWindow.document.write(printContent)
	printWindow.document.close()

	// Auto print after load
	printWindow.onload = () => {
		setTimeout(() => {
			printWindow.print()
		}, 250)
	}
}

/**
 * Print invoice by name, fetching print format from POS Profile
 * @param {string} invoiceName - The name of the invoice to print
 * @param {string} printFormat - Optional print format override
 * @param {string} letterhead - Optional letterhead override
 */
export async function printInvoiceByName(
	invoiceName,
	printFormat = null,
	letterhead = null,
) {
	try {
		// Fetch the invoice document using proper POS API endpoint
		const invoiceDoc = await call("pos_next.api.invoices.get_invoice", {
			invoice_name: invoiceName,
		})

		if (!invoiceDoc) {
			throw new Error("Invoice not found")
		}

		// If no print format specified and invoice has a POS Profile, fetch its print settings
		if (!printFormat && invoiceDoc.pos_profile) {
			try {
				const posProfileDoc = await call("frappe.client.get", {
					doctype: "POS Profile",
					name: invoiceDoc.pos_profile,
				})

				if (posProfileDoc) {
					printFormat = posProfileDoc.print_format
					letterhead = letterhead || posProfileDoc.letter_head
				}
			} catch (error) {
				log.warn("Could not fetch POS Profile print settings:", error)
				// Continue with default print format
			}
		}

		// Print the invoice
		return await printInvoice(invoiceDoc, printFormat, letterhead)
	} catch (error) {
		log.error("Error fetching invoice for print:", error)
		throw error
	}
}

/**
 * Generates and prints a Shift Closing Receipt
 * @param {Object} closingData - The shift closing data
 */
export function printShiftClosing(closingData) {
	// Open print window with receipt size dimensions (80mm ≈ 302px at 96 DPI)
	const printWindow = window.open("", "_blank", "width=350,height=600")

	const salesTotal = closingData.sales_total ?? closingData.grand_total ?? 0
	const taxesTotal = closingData.taxes
		? closingData.taxes.reduce(
				(acc, t) => acc + (Number.parseFloat(t.amount) || 0),
				0,
			)
		: 0
	const paymentReconciliation = closingData.payment_reconciliation || []

	const totalExpected = paymentReconciliation.reduce(
		(acc, p) => acc + (Number.parseFloat(p.expected_amount) || 0),
		0,
	)
	const totalActual = paymentReconciliation.reduce(
		(acc, p) => acc + (Number.parseFloat(p.closing_amount) || 0),
		0,
	)
	const totalDifference = totalActual - totalExpected

	const printContent = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<title>${__("Shift Report - {0}", [closingData.pos_profile])}</title>
			<style>
				* {
					margin: 0;
					padding: 0;
					box-sizing: border-box;
				}

				body {
					font-family: 'Courier New', monospace;
					padding: 10px;
					width: 80mm;
					margin: 0;
					max-width: 80mm;
					font-weight: bold;
					color: black;
				}

				.header {
					text-align: center;
					margin-bottom: 20px;
					border-bottom: 2px dashed #000;
					padding-bottom: 10px;
				}

                .title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                .subtitle {
                    font-size: 12px;
                }

                .section {
                    margin-bottom: 15px;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 10px;
                }

                .section-title {
                    font-weight: bold;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                    font-size: 12px;
                    border-bottom: 1px solid #000;
                    display: inline-block;
                }

                .row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 3px;
                    font-size: 12px;
                }

                .row.bold {
                    font-weight: bold;
                }

                .footer {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 10px;
                }

				@media print {
					@page {
						size: 80mm auto;
						margin: 0;
					}

					body {
						width: 80mm;
						padding: 5mm;
						margin: 0;
					}

					.no-print {
						display: none;
					}
				}
			</style>
		</head>
		<body>
            <div class="header">
                <div class="title">${__("SHIFT CLOSING REPORT")}</div>
                <div class="title">${closingData.pos_profile}</div>
                <div class="subtitle">${new Date().toLocaleString()}</div>
            </div>

            <div class="section">
                <div class="row">
                    <span>${__("Start:")}</span>
                    <span>${new Date(closingData.period_start_date).toLocaleString()}</span>
                </div>
                <div class="row">
                    <span>${__("End:")}</span>
                    <span>${new Date().toLocaleString()}</span>
                </div>
                  <div class="row">
                    <span>${__("User:")}</span>
                    <span>${closingData.owner || "User"}</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">${__("SALES SUMMARY")}</div>
                <div class="row">
                    <span>${__("Gross Sales:")}</span>
                    <span>${formatCurrency(salesTotal)}</span>
                </div>
                <div class="row">
                    <span>${__("Returns:")}</span>
                    <span>${formatCurrency(closingData.returns_total)}</span>
                </div>
                <div class="row">
                    <span>${__("Tax Collected:")}</span>
                    <span>${formatCurrency(taxesTotal)}</span>
                </div>
                <div class="row bold" style="margin-top: 5px; border-top: 1px solid #000; padding-top: 2px;">
                    <span>${__("NET SALES:")}</span>
                    <span>${formatCurrency(closingData.grand_total)}</span>
                </div>
            </div>

             <div class="section">
                <div class="section-title">${__("PAYMENTS")}</div>
                ${paymentReconciliation
									.map(
										(p) => `
                    <div style="margin-bottom: 5px;">
                        <div class="row bold">
                            <span>${p.mode_of_payment}</span>
                        </div>
                        <div class="row">
                            <span>Open:</span>
                            <span>${formatCurrency(p.opening_amount)}</span>
                        </div>
                        <div class="row">
                            <span>Expected:</span>
                            <span>${formatCurrency(p.expected_amount)}</span>
                        </div>
                         <div class="row">
                            <span>Actual:</span>
                            <span>${formatCurrency(p.closing_amount)}</span>
                        </div>
                         <div class="row">
                            <span>Diff:</span>
                            <span>${formatCurrency(Number.parseFloat(p.closing_amount || 0) - Number.parseFloat(p.expected_amount || 0))}</span>
                        </div>
                    </div>
                `,
									)
									.join("")}
            </div>

             <div class="section">
                 <div class="row bold">
                    <span>${__("TOTAL EXPECTED:")}</span>
                    <span>${formatCurrency(totalExpected)}</span>
                </div>
                <div class="row bold">
                    <span>${__("TOTAL ACTUAL:")}</span>
                    <span>${formatCurrency(totalActual)}</span>
                </div>
                 <div class="row bold">
                    <span>${__("VARIANCE:")}</span>
                    <span>${formatCurrency(totalDifference)}</span>
                </div>
            </div>

            <div class="footer">
                ${__("Printed on")} ${new Date().toLocaleString()}
                <br>
                Powered by BrainWise
            </div>

			<div class="no-print" style="text-align: center; margin-top: 20px;">
				<button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">
					${__("Print Report")}
				</button>
				<button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; margin-left: 10px;">
					${__("Close")}
				</button>
			</div>
		</body>
		</html>
	`

	printWindow.document.write(printContent)
	printWindow.document.close()

	// Auto print after load
	printWindow.onload = () => {
		setTimeout(() => {
			printWindow.print()
		}, 250)
	}
}
