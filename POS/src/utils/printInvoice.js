import { call } from "@/utils/apiWrapper"
import { logger } from "@/utils/logger"
import { formatCurrency } from "@/utils/currency"
import { getCachedCompanyAddress } from "@/utils/offline/cache"

const log = logger.create("PrintInvoice")

/**
 * Print invoice using Frappe's print format system
 * @param {Object} invoiceData - The invoice document data
 * @param {string} printFormat - The print format name from POS Profile (optional)
 * @param {string} letterhead - The letterhead name (optional)
 * @param {string} paperSize - "58mm" or "80mm" — controls CSS override only, not which format is used
 */
export async function printInvoice(
	invoiceData,
	printFormat = null,
	letterhead = null,
	paperSize = null,
) {
	let format = printFormat
	try {
		if (!invoiceData || !invoiceData.name) {
			throw new Error("Invalid invoice data")
		}

		const doctype = invoiceData.doctype || "Sales Invoice"

		// If no format given, try to get from POS Profile on the invoice
		if (!format && invoiceData.pos_profile) {
			try {
				const posProfileDoc = await call("frappe.client.get", {
					doctype: "POS Profile",
					name: invoiceData.pos_profile,
				})
				if (posProfileDoc?.print_format) {
					format = posProfileDoc.print_format
					if (!letterhead) letterhead = posProfileDoc.letter_head
				}
			} catch (e) {
				log.warn("Could not fetch POS Profile for print format:", e)
			}
		}
		format = format || "POS Next Receipt"

		const is80mm = paperSize === "80mm"

		const params = new URLSearchParams({
			doctype,
			name: invoiceData.name,
			format,
			no_letterhead: letterhead ? 0 : 1,
			_lang: "en",
			_t: Date.now(),
		})
		if (letterhead) params.append("letterhead", letterhead)

		const printUrl = `/printview?${params.toString()}`

		if (!is80mm) {
			// 58mm: no CSS override needed — just let trigger_print handle it
			params.append("trigger_print", "1")
			const pw = window.open(`/printview?${params.toString()}`, "_blank", "width=800,height=600")
			if (!pw) throw new Error("Failed to open print window. Please check your popup blocker settings.")
			return true
		}

		// 80mm: open without trigger_print, inject CSS override, then print manually
		const printWindow = window.open(printUrl, "_blank", "width=800,height=600")
		if (!printWindow) throw new Error("Failed to open print window. Please check your popup blocker settings.")

		await new Promise((resolve) => {
			let done = false
			const inject = () => {
				if (done) return
				done = true
				try {
					const style = printWindow.document.createElement("style")
					style.textContent = `
						@page { size: 80mm auto !important; margin: 0 !important; }
						body, .print-format {
							width: 80mm !important;
							max-width: 80mm !important;
						}
					`
					printWindow.document.head.appendChild(style)
				} catch (e) {
					log.warn("Could not inject 80mm CSS override:", e)
				}
				setTimeout(() => {
					printWindow.focus()
					printWindow.print()
					resolve()
				}, 300)
			}
			printWindow.addEventListener("load", inject)
			// Fallback if load event already fired or is slow
			setTimeout(inject, 1500)
		})

		return true
	} catch (error) {
		log.error("Error printing with Frappe print format:", error)
		return printInvoiceCustom(invoiceData, paperSize === "80mm" ? "80 PRINTER" : "58 PRINTER")
	}
}

/**
 * Generates and prints a custom POS receipt matching the "58 TEST" Jinja format.
 * Uses one template for both 58mm and 80mm — only CSS width changes.
 * @param {Object} invoiceData
 * @param {string} printFormat - "58 PRINTER" or "80 PRINTER"
 */
export function printInvoiceCustom(invoiceData, printFormat = "58 PRINTER") {
	const is80mm = printFormat && printFormat.includes("80")
	const paperWidth = is80mm ? "80mm" : "58mm"
	const windowWidth = is80mm ? "350" : "220"
	const addr = getCachedCompanyAddress()

	const fmtDate = (d) => {
		const dd = String(d.getDate()).padStart(2, '0')
		const mm = String(d.getMonth() + 1).padStart(2, '0')
		const yyyy = d.getFullYear()
		return `${dd}-${mm}-${yyyy}`
	}
	const fmtTime = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`

	let docDateStr = fmtDate(new Date(invoiceData.posting_date || Date.now()))
	let docTimeStr = invoiceData.posting_time ? invoiceData.posting_time.substring(0, 5) : fmtTime(new Date())

	if (invoiceData.name && invoiceData.name.startsWith("OFFLINE-")) {
		const parts = invoiceData.name.split("-")
		if (parts.length > 1) {
			const timestamp = Number.parseInt(parts[1], 10)
			if (!isNaN(timestamp)) {
				const dateObj = new Date(timestamp)
				docDateStr = fmtDate(dateObj)
				docTimeStr = fmtTime(dateObj)
			}
		}
	}

	const rp = (val) => {
		const v = Math.floor(val || 0)
		if (v >= 1000000) return `Rp${Math.floor(v/1000000)}.${String(Math.floor((v%1000000)/1000)).padStart(3,'0')}.${String(v%1000).padStart(3,'0')}`
		if (v >= 1000) return `Rp${Math.floor(v/1000)}.${String(v%1000).padStart(3,'0')}`
		return `Rp${v}`
	}
	const num = (val) => {
		const v = Math.floor(val || 0)
		if (v >= 1000000) return `${Math.floor(v/1000000)}.${String(Math.floor((v%1000000)/1000)).padStart(3,'0')}.${String(v%1000).padStart(3,'0')}`
		if (v >= 1000) return `${Math.floor(v/1000)}.${String(v%1000).padStart(3,'0')}`
		return `${v}`
	}

	const showInclusiveTax = invoiceData.flags?.show_inclusive_tax_in_print || invoiceData.show_inclusive_tax_in_print
	const paidAmount = invoiceData.paid_amount || (invoiceData.payments || []).reduce((s, r) => s + Number(r.amount || 0), 0)
	const rawCustomer = invoiceData.customer_name || invoiceData.customer || "Guest"
	const trimmedCustomer = rawCustomer.split(' XSA')[0].split(' XPY')[0].split(' XS')[0].split(' - ')[0]
	const ownerShort = (invoiceData.owner || "Kasir").substring(0, 8)
	const redeemLoyalty = invoiceData.redeem_loyalty_points || invoiceData.loyalty_amount > 0

	const printWindow = window.open("", "_blank", `width=${windowWidth},height=600`)

	const printContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${invoiceData.name || "Invoice"}</title>
<style>
	@page { size: ${paperWidth} auto; margin: 0; }
	* { box-sizing: border-box; }
	body, .print-format {
		font-family: 'Courier New', 'Courier', monospace;
		width: ${paperWidth};
		max-width: ${paperWidth};
		margin: 0;
		padding: 2px 20px;
		font-size: 12px;
		line-height: 1.4;
		background: #fff;
		font-weight: bold;
	}
	p { margin: 0; padding: 0; font-weight: bold; }
	hr { border: none; border-top: 1px dashed #333; margin: 2px 0; }
	.tc { text-align: center; }
	.rgt { text-align: right; }
	@media print { .no-print { display: none; } }
</style>
</head>
<body class="print-format">

${addr ? `
${addr.address_title ? `<p class="tc" style="font-size:13px; letter-spacing:1px; font-weight:bold;">${addr.address_title}</p>` : ""}
${addr.address_line1 ? `<p class="tc" style="font-size:8px; font-weight:bold;">${addr.address_line1}</p>` : ""}
${addr.address_line2 ? `<p class="tc" style="font-size:8px; font-weight:bold;">${addr.address_line2}</p>` : ""}
<p class="tc" style="font-size:8px; font-weight:bold;">${[addr.city, addr.phone].filter(Boolean).join(" | ")}</p>
` : `<p class="tc" style="font-size:13px; letter-spacing:1px; font-weight:bold;">${invoiceData.company || ""}</p>`}
<hr>
<p>No : ${invoiceData.name}</p>
<p>Ksr: ${ownerShort} Tgl: ${docDateStr}</p>
<p>Pel: ${trimmedCustomer}</p>
<hr>

${(invoiceData.items || []).map((item) => {
	const qty = item.qty !== undefined ? item.qty : (item.quantity || 0)
	const rate = item.rate || item.price_list_rate || 0
	const amount = item.amount !== undefined ? item.amount : qty * rate
	const discountAmount = item.discount_amount || 0
	const displayQty = qty % 1 === 0 ? Math.floor(qty) : qty
	const itemName = item.item_name || item.item_code
	return `<p>${itemName}</p>
<p>${displayQty} x ${num(rate)}<span style="float:right;">${num(amount)}</span></p>${discountAmount > 0 ? `\n<p>  Diskon<span style="float:right;">-${num(discountAmount)}</span></p>` : ""}${item.serial_no ? `\n<p style="font-size:7px;">S/N: ${item.serial_no.replace(/\n/g, ", ")}</p>` : ""}`
}).join("\n")}

<hr>
${showInclusiveTax
	? `<p>Total Excl. Tax<span style="float:right;">${num(invoiceData.net_total || invoiceData.grand_total)}</span></p>`
	: `<p>Total<span style="float:right;">${num(invoiceData.total || invoiceData.grand_total)}</span></p>`}
${(invoiceData.taxes || []).filter(row => !row.included_in_print_rate || showInclusiveTax).map(row => {
	const desc = row.description || ""
	const label = desc.includes('%') ? desc : `${desc}@${row.rate}%`
	return `<p>${label}<span style="float:right;">${num(row.tax_amount)}</span></p>`
}).join("\n")}
${invoiceData.discount_amount ? `<p>Diskon<span style="float:right;">-${num(invoiceData.discount_amount)}</span></p>` : ""}
${invoiceData.loyalty_amount ? `<p>Tukar Poin<span style="float:right;">-${num(invoiceData.loyalty_amount)}</span></p>` : ""}
<p style="font-size:11px; border-top:2px solid #000; border-bottom:2px solid #000; margin-top:2px; padding:3px 0;">Grand Total<span style="float:right;">${rp(invoiceData.grand_total)}</span></p>
${invoiceData.rounded_total ? `<p>Dibulatkan<span style="float:right;">${rp(invoiceData.rounded_total)}</span></p>` : ""}
${(invoiceData.payments || []).map(row => `<p>${row.mode_of_payment}<span style="float:right;">${num(row.amount)}</span></p>`).join("\n")}
<p style="border-top:1px dashed #333; margin-top:2px; padding-top:2px;">Bayar<span style="float:right;">${num(paidAmount)}</span></p>
${invoiceData.change_amount > 0 ? `<p>Kembali<span style="float:right;">${num(invoiceData.change_amount)}</span></p>` : ""}
${invoiceData.outstanding_amount > 0 ? `<p>Sisa Tagihan<span style="float:right;">${num(invoiceData.outstanding_amount)}</span></p>` : ""}

${(invoiceData._earned_loyalty_points !== undefined || invoiceData._total_loyalty_points !== undefined) ? `<hr>
<p class="tc" style="font-size:10px;">-- LOYALTY POINTS --</p>
${!redeemLoyalty && invoiceData._earned_loyalty_points ? `<p>Poin Didapat<span style="float:right;">+${invoiceData._earned_loyalty_points}</span></p>` : ""}
${redeemLoyalty && invoiceData._earned_loyalty_points ? `<p>Poin Ditukar<span style="float:right;">-${invoiceData._earned_loyalty_points}</span></p>` : ""}
${invoiceData._total_loyalty_points ? `<p>Total Poin<span style="float:right;">${invoiceData._total_loyalty_points}</span></p>` : ""}` : ""}

<hr>
${invoiceData.terms ? `<p style="font-size:7px;">${invoiceData.terms}</p>` : ""}
<p class="tc" style="font-size:8px; margin-top:2px;">Terima kasih, sampai jumpa lagi.</p>

<div class="no-print" style="text-align:center; margin-top:20px;">
	<button onclick="window.print()" style="padding:10px 20px; font-size:14px; cursor:pointer;">Print</button>
	<button onclick="window.close()" style="padding:10px 20px; font-size:14px; cursor:pointer; margin-left:10px;">Close</button>
</div>
</body>
</html>`

	printWindow.document.write(printContent)
	printWindow.document.close()

	// Auto print after load
	printWindow.onload = () => {
		printWindow.print()
	}
}

/**
 * Print invoice by name, fetching print format from POS Profile
 * @param {string} invoiceName - The name of the invoice to print
 * @param {string} printFormat - Optional print format override
 * @param {string} letterhead - Optional letterhead override
 * @param {string} paperSize - "58mm" or "80mm" from the POS dropdown
 */
export async function printInvoiceByName(
	invoiceName,
	printFormat = null,
	letterhead = null,
	paperSize = null,
) {
	try {
		const invoiceDoc = await call("pos_next.api.invoices.get_invoice", {
			invoice_name: invoiceName,
		})

		if (!invoiceDoc) {
			throw new Error("Invoice not found")
		}

		// Fetch loyalty points if invoice has a loyalty program
		if (invoiceDoc.loyalty_program) {
			try {
				const loyaltyData = await call("pos_next.api.invoices.get_invoice_loyalty_points", {
					invoice_name: invoiceName,
				})
				if (loyaltyData) {
					invoiceDoc._earned_loyalty_points = loyaltyData.earned_points
					invoiceDoc._total_loyalty_points = loyaltyData.total_points
				}
			} catch (err) {
				log.warn("Could not fetch loyalty points for print:", err)
			}
		}

		// printInvoice will auto-fetch POS Profile format if printFormat is null
		return await printInvoice(invoiceDoc, printFormat, letterhead, paperSize)
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
		printWindow.print()
	}
}
