"""Original four-bar studies. Notes are written pitches in scientific pitch notation.
Each character of a rhythm is one attack. h/q/e/d are half, quarter, eighth
and dotted quarter. A dash is a quarter rest. A period marks staccato.
For snare, R and L are right and left strokes. > marks an accent.
"""
TITLES = ['First Steps', 'The Climb', 'Half-Step Hero', 'Breakthrough', 'Chromatic Chase', 'Full Throttle']
TEMPOS = [68, 72, 72, 64, 80, 96]
RHYTHMS = [
    'qqh|qqh|qqqq|hqq',
    'qqeeq|qqh|eeqeeq|hqq',
    'qeeqq|eeqh|qeeeeq|qqh',
    'hh|qqh|qeeqq|hqq',
    'eeeeeeee|deqq|eeeeeeee|qqh',
    'qeeeeq|eeeeqee|eeeeeeee|deqq',
]
# Name, clef, written key (fifths), sounding-minus-written semitones, GM program.
INSTRUMENTS = {
    'flute': ('Flute', 'G', -2, 0, 73),
    'clarinet': ('B♭ Clarinet', 'G', 0, -2, 71),
    'alto': ('E♭ Alto Saxophone', 'G', 1, -9, 65),
    'tenor': ('B♭ Tenor Saxophone', 'G', 0, -14, 66),
    'trumpet': ('B♭ Trumpet', 'G', 0, -2, 56),
    'horn': ('F Horn', 'G', -1, -7, 60),
    'trombone': ('Trombone', 'F', -2, 0, 57),
    'euphonium': ('Baritone / Euphonium B.C.', 'F', -2, 0, 58),
    'mallets': ('Mallets · Marimba', 'G', 0, 0, 12),
    'snare': ('Snare Drum', 'percussion', 0, 0, None),
}
SCORES = {
    'clarinet': [
        ('Let the five notes ring evenly.', 'C4 D4 E4|E4 F4 G4|G4 F4 E4 D4|C4 C4 -'),
        ('Keep the throat A light as the line turns.', 'D4 E4 F4 G4 A4|G4 F4 E4|E4 F4 G4 A4 G4 E4|D4 D4 -'),
        ('Rock between G, G-sharp and throat A with small movements.', 'G4 G#4 A4 G4 E4|G4 G#4 A4 Bb4|A4 G#4 A4 G4 F#4 G4|A4 G4 G4'),
        ('Hold throat A, then cover the holes together for clarion B.', 'A4 B4|A4 B4 C5|A4 A4 B4 C5 B4|A4 B4 -'),
        ('Carry air through the B-flat to B-natural crossing.', 'G4 G#4 A4 Bb4 B4 C5 B4 Bb4|A4 B4 C5 B4|C5 B4 Bb4 A4 G#4 A4 Bb4 B4|C5 B4 A4'),
        ('Let the short notes bounce. Keep the air moving over the break.', 'G4. A4 B4 C5 B4 A4.|G4 G#4 A4 Bb4 B4 A4 B4|C5 B4 Bb4 A4 G4 A4 B4 C5|B4 A4 G4. -'),
    ],
    'flute': [
        ('Keep a clear center to each sound.', 'Bb4 C5 D5|D5 Eb5 F5|F5 D5 Eb5 C5|Bb4 Bb4 -'),
        ('Aim the air steadily as the line rises to G.', 'Bb4 C5 D5 Eb5 F5|Eb5 F5 G5|G5 F5 Eb5 D5 C5 D5|Bb4 Bb4 -'),
        ('Use the right-hand keys cleanly around E-flat.', 'D5 Eb5 E5 F5 D5|Eb5 E5 F5 G5|F5 E5 Eb5 D5 Db5 D5|F5 Eb5 D5'),
        ('Release the left index finger for middle D.', 'C5 D5|C5 D5 Eb5|D5 C5 D5 Eb5 D5|C5 D5 -'),
        ('Keep C to D even inside the chromatic turn.', 'C5 Db5 D5 Eb5 E5 F5 E5 Eb5|D5 C5 D5 F5|G5 Gb5 F5 E5 Eb5 D5 Db5 C5|D5 C5 Bb4'),
        ('Give the rising figure a light tongue and one steady air stream.', 'Bb4. C5 D5 Eb5 F5 G5.|F5 E5 Eb5 D5 C5 D5 Eb5|F5 E5 Eb5 D5 C5 D5 Eb5 F5|D5 C5 Bb4. -'),
    ],
    'alto': [
        ('Match the sound as you add and lift right-hand fingers.', 'D4 E4 F#4|F#4 G4 A4|A4 G4 F#4 E4|D4 D4 -'),
        ('Add the octave key as you move from C to D.', 'G4 A4 B4 C5 D5|C5 D5 E5|E5 D5 C5 B4 A4 B4|G4 G4 -'),
        ('Keep the G-sharp pinky close to its key.', 'G4 G#4 A4 B4 A4|G4 G#4 A4 B4|A4 G#4 A4 B4 C5 B4|A4 G#4 A4'),
        ('Coordinate the thumb and right hand on middle D.', 'C5 D5|C5 D5 E5|B4 C5 D5 E5 D5|C5 D5 -'),
        ('Cross open C-sharp smoothly in both directions.', 'A4 Bb4 B4 C5 C#5 D5 Eb5 D5|C#5 D5 E5 D5|E5 Eb5 D5 C#5 C5 B4 Bb4 A4|B4 A4 G4'),
        ('Start each short G cleanly and let the eighths travel.', 'G4. A4 B4 C5 D5 E5.|D5 C#5 D5 E5 B4 A4 B4|C5 C#5 D5 Eb5 E5 D5 C5 B4|A4 B4 G4. -'),
    ],
    'tenor': [
        ('Keep both hands curved as the notes rise.', 'D4 E4 F4|F4 G4 A4|A4 G4 F4 E4|D4 D4 -'),
        ('Let the left hand lead the turn through B and C.', 'F4 G4 A4 B4 C5|B4 A4 G4|G4 A4 B4 C5 B4 A4|G4 F4 -'),
        ('Place the B-flat and B-natural fingers deliberately.', 'A4 Bb4 B4 C5 A4|A4 Bb4 B4 C5|B4 Bb4 A4 G#4 A4 B4|C5 B4 A4'),
        ('Switch the octave key with the fingers from C to D.', 'C5 D5|B4 C5 D5|C5 D5 E5 D5 B4|C5 D5 -'),
        ('Keep the thumb relaxed across C-sharp and D.', 'G4 G#4 A4 Bb4 B4 C5 C#5 D5|E5 D5 C5 B4|D5 C#5 C5 B4 Bb4 A4 Ab4 G4|A4 F4 G4'),
        ('Connect the octave-key turn before adding speed.', 'G4. B4 C5 D5 E5 D5.|C5 C#5 D5 E5 D5 B4 C5|D5 C#5 C5 B4 Bb4 A4 G#4 A4|B4 A4 G4. -'),
    ],
    'trumpet': [
        ('Depress the valves fully with curved fingers.', 'C4 D4 E4|E4 F4 G4|G4 F4 D4 E4|C4 C4 -'),
        ('Let the air carry F to the open G.', 'C4 D4 E4 F4 G4|E4 F4 A4|A4 G4 F4 E4 D4 E4|C4 C4 -'),
        ('Move the valves together through F, F-sharp and G.', 'E4 F4 F#4 G4 E4|F4 F#4 G4 A4|G4 F#4 F4 E4 Eb4 E4|F4 D4 C4'),
        ('Listen for two centered pitches on open C and G.', 'C4 G4|C4 E4 G4|F4 E4 F4 G4 E4|D4 C4 -'),
        ('Keep each valve change inside the pulse.', 'D4 Eb4 E4 F4 F#4 G4 Ab4 G4|F#4 G4 A4 G4|A4 Ab4 G4 F#4 F4 E4 Eb4 D4|E4 D4 C4'),
        ('Give the opening call a clear attack and save air for the finish.', 'C4. D4 E4 F4 G4 A4.|G4 F#4 G4 A4 E4 F4 G4|G4 F#4 F4 E4 Eb4 D4 E4 G4|E4 D4 C4. -'),
    ],
    'horn': [
        ('Hear the next pitch before each attack.', 'C4 D4 E4|E4 F4 G4|G4 F4 D4 E4|C4 C4 -'),
        ('Sing the top of the arc before you play it.', 'C4 D4 E4 F4 G4|E4 G4 A4|A4 G4 F4 E4 D4 E4|C4 C4 -'),
        ('Center the neighboring A-flat and A-natural.', 'G4 Ab4 A4 Bb4 G4|Ab4 A4 Bb4 C5|Bb4 A4 Ab4 G4 F#4 G4|A4 G4 F4'),
        ('Use the same F-side open fingering for written C, E and G.', 'C4 E4|C4 E4 G4|G4 F4 E4 C4 E4|G4 G4 -'),
        ('Settle on the partial before changing direction.', 'E4 F4 F#4 G4 G#4 A4 Bb4 A4|G4 A4 Bb4 G4|A4 Ab4 G4 F#4 F4 E4 Eb4 E4|G4 E4 F4'),
        ('Center the opening call, then tongue the answer lightly.', 'F4. G4 A4 Bb4 A4 C5.|Bb4 A4 Ab4 G4 F4 G4 A4|Bb4 A4 Ab4 G4 F#4 G4 A4 G4|F4 E4 F4. -'),
    ],
    'trombone': [
        ('Arrive at each slide position on the beat.', 'Bb2 C3 D3|D3 Eb3 F3|F3 Eb3 D3 C3|Bb2 Bb2 -'),
        ('Hear the upward line while the slide changes direction.', 'Bb2 C3 D3 Eb3 F3|Eb3 F3 G3|G3 F3 Eb3 D3 C3 D3|Bb2 Bb2 -'),
        ('Keep the short slide moves around F precise.', 'Eb3 E3 F3 E3 D3|Eb3 E3 F3 G3|F3 E3 Eb3 D3 Db3 D3|Eb3 D3 Bb2'),
        ('Stay in first position for low B-flat and F above it.', 'Bb2 F3|Bb2 D3 F3|Eb3 D3 Eb3 F3 D3|Bb2 F3 -'),
        ('Choose compact slide paths around E-flat, E and F.', 'Db3 D3 Eb3 E3 F3 E3 Eb3 D3|Eb3 F3 Gb3 F3|G3 Gb3 F3 E3 Eb3 D3 Db3 C3|D3 C3 Bb2'),
        ('Give the opening B-flat space, then move the slide quickly.', 'Bb2. D3 Eb3 F3 G3 F3.|F3 E3 Eb3 D3 Eb3 D3 Eb3|F3 E3 Eb3 D3 Db3 D3 Eb3 F3|D3 C3 Bb2. -'),
    ],
    'euphonium': [
        ('Match the attack as the valve combinations change.', 'Bb2 C3 D3|Eb3 D3 F3|F3 Eb3 C3 D3|Bb2 Bb2 -'),
        ('Keep the sound full at the change of partial.', 'Bb2 C3 D3 Eb3 F3|D3 F3 G3|G3 F3 Eb3 D3 C3 Eb3|D3 Bb2 -'),
        ('Keep the valve changes together around E-natural.', 'D3 Eb3 E3 F3 D3|Eb3 E3 F3 G3|F3 E3 Eb3 D3 Db3 D3|F3 D3 Bb2'),
        ('Match the open B-flat and F, then echo with first-valve notes.', 'Bb2 F3|Ab2 Eb3 F3|Bb2 C3 D3 F3 Eb3|D3 Bb2 -'),
        ('Let the valve fingers follow the chromatic turn evenly.', 'C3 Db3 D3 Eb3 E3 F3 Gb3 G3|F3 D3 Eb3 F3|G3 Gb3 F3 E3 Eb3 D3 Db3 C3|Eb3 D3 Bb2'),
        ('Bounce off the short notes and connect the climbing run.', 'Bb2. C3 D3 Eb3 F3 G3.|F3 E3 F3 G3 D3 Eb3 F3|G3 Gb3 F3 E3 Eb3 D3 Eb3 F3|D3 C3 Bb2. -'),
    ],
    'mallets': [
        ('Alternate hands and strike near the center of each bar.', 'C4 D4 E4|E4 F4 G4|G4 E4 F4 D4|C4 C4 -'),
        ('Look ahead to the turnaround bar.', 'C4 D4 E4 F4 G4|G4 A4 B4|B4 A4 G4 F4 E4 D4|C4 C4 -'),
        ('Move to the raised bars with small, even strokes.', 'D4 D#4 E4 G4 E4|F4 F#4 G4 A4|G4 F#4 G4 E4 D#4 E4|G4 D4 C4'),
        ('Aim the mallets before the skips and let each stroke rebound.', 'C4 G4|D4 A4 G4|E4 F4 G4 C5 B4|G4 C5 -'),
        ('Trace the path between the two rows before adding speed.', 'E4 F4 F#4 G4 G#4 A4 Bb4 B4|C5 B4 G4 E4|A4 Ab4 G4 F#4 F4 E4 Eb4 D4|G4 D4 C4'),
        ('Watch the next landing spot through the octave finish.', 'C4. E4 F4 G4 A4 C5.|B4 Bb4 A4 Ab4 G4 E4 G4|A4 Ab4 G4 F#4 F4 E4 F4 G4|C5 G4 C4. -'),
    ],
    'snare': [
        ('Alternate hands. Match the sound of your left and right strokes.', 'R L R|L R L|R L R L|R L -'),
        ('Keep the eighths even as the lead hand changes.', 'R L R L R|L R L|R L R L R L|R L -'),
        ('Echo a pair of right-hand strokes with a pair on the left.', 'R L L R L|R R L R|L R R L L R|L R L'),
        ('Let each hand rebound for the double stroke.', 'R L|R R L|L R R L L|R L -'),
        ('Carry the double strokes through each change of direction.', 'R L R R L R L L|R L R L|L R L L R L R R|L R L'),
        ('Lift for the accents and keep the taps close to the head.', 'R> L R L L R>|L R L L R L R|L> R L L R> L R R|L> R L> -'),
    ],
}
