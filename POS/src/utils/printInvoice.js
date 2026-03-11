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
	const widthCSS = is58mm ? "48mm" : "72mm" // 48mm safe area for 58mm paper
	const windowWidth = is58mm ? "220" : "350"
    
	let docDateStr = new Date(
		invoiceData.posting_date || Date.now(),
	).toLocaleDateString("id-ID", {day: '2-digit', month: '2-digit', year: '2-digit'})
	let docTimeStr = invoiceData.posting_time ? invoiceData.posting_time.substring(0, 5) : new Date().toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit'})

	if (invoiceData.name && invoiceData.name.startsWith("OFFLINE-")) {
		const parts = invoiceData.name.split("-")
		if (parts.length > 1) {
			const timestamp = Number.parseInt(parts[1], 10)
			if (!isNaN(timestamp)) {
				const dateObj = new Date(timestamp)
				docDateStr = dateObj.toLocaleDateString("id-ID", {day: '2-digit', month: '2-digit', year: '2-digit'})
				docTimeStr = dateObj.toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit'})
			}
		}
	}

	const printWindow = window.open("", "_blank", `width=${windowWidth},height=600`)

	// Helper to format number without currency symbol for compact items
    const formatNumber = (val) => new Intl.NumberFormat('id-ID').format(val || 0)

	const printContent = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<title>${__("Invoice - {0}", [invoiceData.name])}</title>
			<style>
				@page {
					size: ${is58mm ? '58mm' : '80mm'} auto;
					margin: 0mm;
				}
				body, .print-format {
					font-family: 'Courier New', Courier, monospace;
					width: ${widthCSS};
					max-width: ${widthCSS};
					margin: 0 auto;
					padding: 0mm;
					font-size: ${is58mm ? '8.5px' : '11px'};
					box-sizing: border-box;
					color: black;
				}
				.print-format table, .print-format tr,
				.print-format td, .print-format div, .print-format p {
					line-height: 1.2;
					vertical-align: top;
				}
				.text-center { text-align: center; }
				.text-right { text-align: right; }
				.text-left { text-align: left; }
				p { margin: 0 0 4px 0; }
				hr {
					border: none;
					border-top: 1px dashed #000;
					margin: 6px 0;
				}
				table {
					width: 100%;
					border-collapse: collapse;
					font-size: ${is58mm ? '8.5px' : '11px'};
                    table-layout: fixed;
				}
				table td {
					padding: 1px 0px;
				}
				
				@media print {
					body, .print-format { padding: 3mm 0mm; }
					.no-print { display: none; }
				}
			</style>
		</head>
		<body class="print-format">
			<!-- HEADER -->
			<p class="text-center" style="margin-bottom: 6px;">
				<b style="font-size: ${is58mm ? '12px' : '14px'};">${invoiceData.company || "X-SHA"}</b><br>
			</p>

			<!-- INFO -->
			<table style="margin-bottom: 4px;">
				<tr>
                    <td colspan="2" class="text-left">${invoiceData.name}</td>
                </tr>
                <tr>
                    <td class="text-left" style="width: 50%;">${docDateStr + " " + docTimeStr}</td>
					<td class="text-right" style="width: 50%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${invoiceData.owner || "Kasir"}/${invoiceData.customer_name || invoiceData.customer || "Guest"}</td>
				</tr>
			</table>

			<hr>

			<!-- ITEMS TABLE -->
			<table>
				<tbody>
					${invoiceData.items
						.map((item) => {
							const qty = item.quantity || item.qty
							const displayRate = item.price_list_rate || item.rate
							const subtotal = qty * displayRate
							const isFree = item.is_free_item

                            const itemName = item.item_name || item.item_code
                            let itemDisplayName = itemName + (isFree ? " (F)" : "")

							return `
						<tr>
							<td class="text-left" style="width: 44%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 2px;">
								${itemDisplayName}
							</td>
							<td class="text-right" style="width: 8%;">${qty}</td>
							<td class="text-right" style="width: 23%; padding-right: 2px;">${formatNumber(displayRate)}</td>
							<td class="text-right" style="width: 25%; font-size: ${is58mm ? '9px' : '11px'};">${formatNumber(subtotal)}</td>
						</tr>
						${item.serial_no ? `<tr><td colspan="4" style="font-size: ${is58mm ? '7.5px' : '8.5px'};">S/N: ${item.serial_no.replace(/\n/g, ", ")}</td></tr>` : ""}
						`
						})
						.join("")}
				</tbody>
			</table>

			<hr style="margin: 4px 0;">

			<!-- TOTALS TABLE -->
			<table>
				<tbody>
					<!-- Subtotal / Total -->
					<tr>
                        <td style="width:30%"></td>
						${
							invoiceData.total_taxes_and_charges && invoiceData.total_taxes_and_charges > 0
								? `
						<td class="text-right" style="width:45%;">TOTAL SBM PPN:</td>
						<td class="text-right" style="width:25%;">${formatNumber((invoiceData.grand_total || 0) - (invoiceData.total_taxes_and_charges || 0))}</td>
						`
								: `
						<td class="text-right" style="width:45%;">HARGA JUAL :</td>
						<td class="text-right" style="width:25%;">${formatNumber(invoiceData.grand_total)}</td>
						`
						}
					</tr>

					<!-- Taxes -->
					${(invoiceData.taxes || [])
						.map(
							(row) => `
					<tr>
                        <td></td>
						<td class="text-right">${row.description.includes("%") ? row.description : row.description}:</td>
						<td class="text-right">${formatNumber(row.tax_amount)}</td>
					</tr>
					`,
						)
						.join("")}

					<!-- Discount -->
					${
						invoiceData.discount_amount
							? `
					<tr>
                        <td></td>
						<td class="text-right">DISCOUNT :</td>
						<td class="text-right">(${formatNumber(Math.abs(invoiceData.discount_amount))})</td>
					</tr>
					`
							: ""
					}
					
					<tr><td colspan="3"><hr style="margin: 2px 0;"></td></tr>

					<!-- Grand Total -->
					<tr>
                        <td></td>
						<td class="text-right"><b>TOTAL :</b></td>
						<td class="text-right"><b>${formatNumber(invoiceData.grand_total)}</b></td>
					</tr>

					<!-- Payment Methods -->
					${(invoiceData.payments || []).filter(function(row) { return Number(row.amount) > 0; })
						.map(
							(row) => `
					<tr>
                        <td></td>
						<td class="text-right">${row.mode_of_payment.toUpperCase()} :</td>
						<td class="text-right">${formatNumber(row.amount)}</td>
					</tr>
					`,
						)
						.join("")}

					<!-- Change Amount -->
					${
						invoiceData.change_amount && invoiceData.change_amount > 0
							? `
					<tr>
                        <td></td>
						<td class="text-right"><b>KEMBALI :</b></td>
						<td class="text-right"><b>${formatNumber(invoiceData.change_amount)}</b></td>
					</tr>
					`
							: ""
					}

					<!-- Outstanding -->
					${
						invoiceData.outstanding_amount && invoiceData.outstanding_amount > 0
							? `
					<tr>
                        <td></td>
						<td class="text-right">KURANG BAYAR :</td>
						<td class="text-right">${formatNumber(invoiceData.outstanding_amount)}</td>
					</tr>
					`
							: ""
					}
				</tbody>
			</table>

			<hr>

			<!-- TERMS & FOOTER -->
			<p class="text-center" style="margin-top:5px; margin-bottom: 2px;">Terima kasih atas kunjungan Anda.</p>
			<p class="text-center" style="font-size: 8px;">Simpan struk ini sebagai bukti pembayaran.</p>
			
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
	const paymentReconciliation = (closingData.payment_reconciliation || []).filter(function(p) { return Number(p.expected_amount) > 0 || Number(p.closing_amount) > 0; })

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
                    <span>${formatCurrency(salesTotal, "IDR", "id-ID")}</span>
                </div>
                <div class="row">
                    <span>${__("Returns:")}</span>
                    <span>${formatCurrency(closingData.returns_total, "IDR", "id-ID")}</span>
                </div>
                <div class="row">
                    <span>${__("Tax Collected:")}</span>
                    <span>${formatCurrency(taxesTotal, "IDR", "id-ID")}</span>
                </div>
                <div class="row bold" style="margin-top: 5px; border-top: 1px solid #000; padding-top: 2px;">
                    <span>${__("NET SALES:")}</span>
                    <span>${formatCurrency(closingData.grand_total, "IDR", "id-ID")}</span>
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
                            <span>${formatCurrency(p.opening_amount, "IDR", "id-ID")}</span>
                        </div>
                        <div class="row">
                            <span>Expected:</span>
                            <span>${formatCurrency(p.expected_amount, "IDR", "id-ID")}</span>
                        </div>
                         <div class="row">
                            <span>Actual:</span>
                            <span>${formatCurrency(p.closing_amount, "IDR", "id-ID")}</span>
                        </div>
                         <div class="row">
                            <span>Diff:</span>
                            <span>${formatCurrency(Number.parseFloat(p.closing_amount || 0) - Number.parseFloat(p.expected_amount || 0), "IDR", "id-ID")}</span>
                        </div>
                    </div>
                `,
									)
									.join("")}
            </div>

             <div class="section">
                 <div class="row bold">
                    <span>${__("TOTAL EXPECTED:")}</span>
                    <span>${formatCurrency(totalExpected, "IDR", "id-ID")}</span>
                </div>
                <div class="row bold">
                    <span>${__("TOTAL ACTUAL:")}</span>
                    <span>${formatCurrency(totalActual, "IDR", "id-ID")}</span>
                </div>
                 <div class="row bold">
                    <span>${__("VARIANCE:")}</span>
                    <span>${formatCurrency(totalDifference, "IDR", "id-ID")}</span>
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
