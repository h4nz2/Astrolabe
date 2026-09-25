/**
 * Handing the postcard to the visitor (#33): a download, the clipboard, or the
 * system's share sheet on phones. All local: the picture only leaves the
 * device if the visitor sends it somewhere themselves.
 */

/** Saves `blob` as a file (the browser's download). */
export function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob)
	const link = document.createElement("a")
	link.href = url
	link.download = fileName
	document.body.append(link)
	link.click()
	link.remove()
	// give the browser a moment to start the download before the URL goes
	setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The browser can put a picture on the clipboard. */
export const canCopyImage = (): boolean =>
	typeof ClipboardItem !== "undefined" &&
	typeof navigator.clipboard?.write === "function"

/**
 * Puts the picture on the clipboard. Takes a promise so the clipboard item is
 * created inside the click (Safari requires it) even if the PNG is still being made.
 */
export const copyImage = (png: Promise<Blob>): Promise<void> =>
	navigator.clipboard.write([new ClipboardItem({ "image/png": png })])

/** The browser can copy text (the link). */
export const canCopyText = (): boolean =>
	typeof navigator.clipboard?.writeText === "function"

/** The share sheet can take this file (phones, some desktops). */
export function canShareFile(file: File): boolean {
	try {
		return (
			typeof navigator.share === "function" &&
			typeof navigator.canShare === "function" &&
			navigator.canShare({ files: [file] })
		)
	} catch {
		return false
	}
}

/** Opens the share sheet; a visitor who cancels is not an error. */
export async function shareFile(file: File, title: string): Promise<void> {
	try {
		await navigator.share({ files: [file], title })
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") return
		throw error
	}
}
