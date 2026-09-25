# Sound credits (#32)

The app's own sounds (the ambient bed, the flight whoosh, the arrival tones) are
synthesized in the browser with the Web Audio API; there are no files for them.

The four recordings in this folder are **real measurements made by spacecraft**,
not sound that travelled through space. Each is a radio or plasma wave measured
by an antenna and played through a speaker, some shifted down into the range we
can hear. They come from the University of Iowa's Radio and Plasma Wave Group,
which built the instruments for NASA missions, and are published at
<https://space-audio.org/> under the **Creative Commons Attribution 4.0
International** licence (the Saturn page states Attribution 3.0).

> Original space audio recordings provided courtesy of NASA and The University of Iowa. https://space-audio.org/

The app shows this credit ("NASA / University of Iowa", the mission, the year
and the licence, linked to the source page) next to every recording.

| File | Body | What | Mission, year | Source | Licence |
| --- | --- | --- | --- | --- | --- |
| `sun-radio-bursts.mp3` | Sun | Type III radio bursts of the 28 Oct 2003 X17 flare (`t2003_301_11.wav`), frequency-shifted | Cassini RPWS, 2003 | https://space-audio.org/typeIII.html | CC BY 4.0 |
| `earth-chorus.mp3` | Earth | Whistler-mode chorus in the radiation belts (`earchor.mp3`) | Injun 3, 1963 | https://space-audio.org/sounds/EarthChorus/EarthChorus.html | CC BY 4.0 |
| `jupiter-whistlers.mp3` | Jupiter | Lightning whistlers (`jwhist.mp3`) | Voyager 1, 1979 | https://space-audio.org/sounds/JupiterWhistlers/JovianWhistlers.html | CC BY 4.0 |
| `saturn-radio.mp3` | Saturn | Saturn kilometric radiation (`SKR-03-324.wav`), first 30 s; frequencies ÷44, time ×22 | Cassini RPWS, 2003 | https://space-audio.org/cassini/SKR1/ | CC BY 3.0 |

Processing (ffmpeg 7): trimmed where noted, 0.3 s fade-in and 0.8 s fade-out,
loudness-normalized to -20 LUFS (true peak -3 dBTP), resampled to 22.05 kHz mono,
MP3 at 32 kbit/s. The content was not otherwise altered.
