/**
 * The QR code that leads from a printed or forwarded postcard back to the
 * interactive view (#33, #10). Encoded on the device by `uqr` (a small,
 * dependency-free port of Nayuki's QR generator), loaded only when a postcard
 * is made. Error correction M survives a crumpled printout; a link too long
 * for a QR code gives none.
 */
export async function qrModules(text: string): Promise<boolean[][] | null> {
	try {
		const { encode } = await import("uqr")
		return encode(text, { ecc: "M", border: 0 }).data
	} catch {
		return null
	}
}
