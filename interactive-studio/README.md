The dashboard branch serves this directory at /interactive-studio/. Download the source ZIP for the Cloudflare dist layout, regression tests and deployment instructions.

# DMS Interactive Band Studio

The student practice room and device-local teacher editor run on a static HTTPS host. There is no application server, account database, telemetry, or recording upload endpoint.

## Open and host

Serve the `dist` directory over HTTPS, or run `python3 -m http.server 8000 --directory dist` and visit localhost. Cloudflare Pages uses an empty build command and `dist` as the output directory. All browser dependencies are included. Add a dashboard link to the deployed studio or paste a generated practice link into Google Classroom.

The classroom distribution includes First Light, an original 16-bar, nine-part study with engraved parts and paired MIDI and MusicXML fixtures. The director's separate, access-controlled studio also contains the 14 verified instrumental publications for Sleigh Ride by Leroy Anderson, arranged by Michael Story. A private studio requires its own access grant. A practice link does not grant access.

## Student workflow

Choose the composition and written part. Start the ensemble or, for a printed part alone, start the independent practice metronome. Choose a section or endpoints to restrict playback. Loop repeats the range. With a linked measure map the clock displays the measure. Verified page geometry also enables score highlighting and automatic page changes. Full recordings can be slowed using pitch-preserving time stretching. Separate tracks allow muting the selected part.

Use headphones and select Record take. The browser requests microphone access. Input settings control recording gain, room-noise calibration, and whether to include the accompaniment. Smart metering uses a median room baseline and reports clipping. It does not remove nearby instruments from the recording. My takes supports replay, download, and deletion. Data is tied to this browser profile and origin. Clearing site data removes local material; downloaded takes and exported practice packs are portable.

## Teacher workflow

1. Open Teacher desk and add or select a composition. Add the named parts and attach each printed PDF.
2. Attach a MIDI arrangement, partwise MusicXML (including compressed MXL), a full recording, or aligned audio stems. Review the part-to-track dropdown after a structured import. Each upload is saved locally.
3. Choose the student playback source and save. Attach zero-aligned stems from the same performance. Separate recordings and stems have independent timing maps. For PDF-only practice you can prepare a timed metronome in the playback settings.
4. Enter measure, source-start-second, source-end-second, and optional rehearsal letter. The importer also accepts a headerless CSV. Number measures in playback order. Define named sections with inclusive measure endpoints. To highlight a printed measure supply a page number and left, top, width, height percentages.
5. Open Student preview and configure the instrument, tempo, track mute and passage. Copy the practice link. For device-local compositions or edits, export a practice pack and distribute it using an authorized classroom channel along with the link. Open the pack on the student's device. Make new links after revising an assignment.

The teacher desk edits only the current browser. It is not a remotely privileged library administrator. Local student changes have no effect on classmates. Publishing library changes for everyone is a source deployment. Add a composition manifest path to dist/catalog.json.

## Music and playback model

- Track notes use concert MIDI pitch and source seconds. PDFs and SVGs preserve written pitches. Engraved notation is supplied independently of the synth. MIDI alone cannot reconstruct an authoritative printed page.
- MIDI import covers standard formats 0 and 1 with PPQ timing and channel/track separation. MusicXML import handles partwise scores with explicit transpositions. Unsupported navigation, SMPTE time division, or ambiguous repeats produce an error. Export an unfolded score for repeat-heavy pieces. For humanized MIDI confirm bar one and the tempo map before assigning printed geometry.
- The look-ahead scheduler uses a shared AudioContext clock. Synth notes and stem slices use sample-clock starts. Tempo changes in audio use WSOLA alignment shared across tracks. Browser scheduling, input latency and Bluetooth devices affect real-world alignment. The recorder uses MediaRecorder with a Web Audio mix. There is no microphone-to-speaker feedback path.
- Demo files, manual maps, reference PDFs and imported media remain separate resources. First Light provides 308 concert-pitch events and 144 verified measure rectangles. Sleigh Ride has no supplied MIDI, stems or performance timing map. Its independent practice click does not track the printed bars. A click-to-load publisher video can play beside the part using its own controls.
- Major modules are app.js (student workflow), reader.js (engraved pages and PDF.js), audio.js and stretch.js (transport), microphone.js, structured.js (parsing), teacher.js, model.js (maps and portable packs), and common.js (IndexedDB and common UI).

## Verification

Run `node --test tests/*.test.mjs` with Node 22+ and Python 3. The browser regression runner uses actual Web Audio, MediaRecorder, PDF.js, ZIP imports, IndexedDB, and responsive iframes. To run it, copy tests/browser.html, tests/browser-checks.js and tests/sleightest.pdf into dist on a local test server, then open browser.html and click Run browser checks. The audio input is a generated tone. Tests cover transposition, tempo/meter changes, synchronization, muting, looping, pitch preservation, recorded audio playback, pack round-trips and assignment restoration at 390, 768 and 1366 pixels. Physical classroom acoustics and district policies require a school-device trial.
