/**
 * Real data sonification (#32): recordings made from measurements by
 * spacecraft, attached to the bodies they belong to. None of them is sound
 * that travelled through space (it cannot); each is a radio or plasma wave
 * measured by an antenna and played through a speaker, sometimes shifted
 * down into the range we can hear. The words for each (title, the honest
 * one-liner, at every reading level) live in `solarSystem.sound.recording.<id>`.
 *
 * Licence, checked per item (see public/assets/sounds/CREDITS.md): all four
 * come from the University of Iowa's Radio and Plasma Wave Group
 * (space-audio.org), recorded by instruments it built for NASA missions, and
 * are published under Creative Commons Attribution 4.0 (the Saturn page
 * states Attribution 3.0). The credit the licence asks for is shown with
 * every recording. Files are trimmed, loudness-matched (-20 LUFS) mono MP3s
 * of 60–120 kB, fetched only when someone presses Listen.
 */

export type RecordingId =
	"sunRadioBursts" | "earthChorus" | "jupiterWhistlers" | "saturnRadio"

export interface Recording {
	/** Also the i18n key: `solarSystem.sound.recording.<id>.*`. */
	readonly id: RecordingId
	/** The body whose card offers it. */
	readonly bodyId: string
	/** Path inside public/ (resolve with `assetUrl`). */
	readonly file: string
	/** The spacecraft that measured it, and when (not translated: proper names and a year). */
	readonly mission: string
	readonly year: number
	/** Length of the clip, seconds. */
	readonly seconds: number
	/** Where the original is published, with its licence. */
	readonly sourceUrl: string
	readonly licence: "CC BY 4.0" | "CC BY 3.0"
}

/** The credit line the licence asks for (same wording in every language: it is a citation). */
export const RECORDING_CREDIT = "NASA / University of Iowa"

export const RECORDINGS: readonly Recording[] = [
	{
		id: "sunRadioBursts",
		bodyId: "sun",
		file: "assets/sounds/sun-radio-bursts.mp3",
		mission: "Cassini",
		year: 2003,
		seconds: 15,
		sourceUrl: "https://space-audio.org/typeIII.html",
		licence: "CC BY 4.0",
	},
	{
		id: "earthChorus",
		bodyId: "earth",
		file: "assets/sounds/earth-chorus.mp3",
		mission: "Injun 3",
		year: 1963,
		seconds: 18,
		sourceUrl: "https://space-audio.org/sounds/EarthChorus/EarthChorus.html",
		licence: "CC BY 4.0",
	},
	{
		id: "jupiterWhistlers",
		bodyId: "jupiter",
		file: "assets/sounds/jupiter-whistlers.mp3",
		mission: "Voyager 1",
		year: 1979,
		seconds: 17,
		sourceUrl:
			"https://space-audio.org/sounds/JupiterWhistlers/JovianWhistlers.html",
		licence: "CC BY 4.0",
	},
	{
		id: "saturnRadio",
		bodyId: "saturn",
		file: "assets/sounds/saturn-radio.mp3",
		mission: "Cassini",
		year: 2003,
		seconds: 30,
		sourceUrl: "https://space-audio.org/cassini/SKR1/",
		licence: "CC BY 3.0",
	},
]

export const recordingById: ReadonlyMap<string, Recording> = new Map(
	RECORDINGS.map((recording) => [recording.id, recording]),
)

/** The recording a body's card offers, if any. */
export const recordingForBody = (bodyId: string): Recording | undefined =>
	RECORDINGS.find((recording) => recording.bodyId === bodyId)
