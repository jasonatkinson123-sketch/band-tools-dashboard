"""Two-part classroom arrangements. Digits 1–5 mean concert Bb C D Eb F.
A zero is a rest. Note lengths use the Beginner Pack notation, in 4/4.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Duet:
    title: str
    tempo: int
    cue: str


def bars(text):
    return text.split('|')


jingle = bars('3 3 3h|3 3 3h|3 5 1 2|3w|4 4 4 4|4 3 3 3e 3e|3 2 2 3|2h 5h|'
              '3 3 3h|3 3 3h|3 5 1 2|3w|4 4 4 4|4 3 3 3e 3e|5 5 4 2|1w')


def share(melody, assignment):
    """A/B pass the tune. X means both play together."""
    assert len(melody) == len(assignment)
    return [[bar if who in (role, 'X') else '0w' for bar, who in zip(melody, assignment)]
            for role in 'AB']


echo = share(jingle, 'ABXXAABB' 'BAXXBAXX')
bells = ['1 0 5 0', '1 0 5 0', '1 0 5 0', '1 0 5 0',
         '1 0 1 0', '1 0 5 0', '5 0 5 0', '5 0 5 0']
answers = bars('1h 0 1|5h 0 5|1w|0 1 2 3|1h 0 1|1h 0 1|5h 0 5|0 2 0 5|'
               '1h 0 1|5h 0 5|1w|0 3 2 1|1h 0 1|1h 0 1|3h 2h|1w')
# Shorten the held melody twice to give the answering phrase three clear beats.
lead = jingle.copy()
lead[3] = lead[11] = '3 0 0h'
DUETS = [
    Duet('Jingle Bells · Jingle Bell Echo', 80,
         'A calls in measure 1, B echoes in measure 2. Join on “jingle all the way.”'),
    Duet('Jingle Bells · Sleigh Team', 80,
         'Play the two-note sleigh rhythm lightly. Trade melody and rhythm at measure 9.'),
    Duet('Jingle Bells · Holiday Duet', 84,
         'A carries the tune. Listen for B’s answers in measures 4 and 12, then land together on the final note.'),
    Duet('Jolly Old Saint Nicholas', 72,
         'Let the long notes support the melody. B takes the tune in measure 9.'),
    Duet('Up on the Housetop', 80,
         'At measure 9, A calls “Ho, ho, ho!” and B answers “Who wouldn’t go?” Join for the last two bars.')
]

# Written notes, ordered from the lowest available pitch to the highest.
REGISTERS = {
    'flute': ('fga12345', 'F4 G4 A4 Bb4 C5 D5 Eb5 F5', 65, 77),
    'clarinet': ('12345', 'C4 D4 E4 F4 G4', 60, 67),
    'alto': ('12345', 'G4 A4 B4 C5 D5', 67, 74),
    'tenor': ('fga123', 'G4 A4 B4 C5 D5 E5', 67, 76),
    'trumpet': ('12345', 'C4 D4 E4 F4 G4', 60, 67),
    'horn': ('fga123', 'C4 D4 E4 F4 G4 A4', 60, 69),
    'trombone': ('12345', 'Bb2 C3 D3 Eb3 F3', 46, 53),
    'euphonium': ('12345', 'Bb2 C3 D3 Eb3 F3', 46, 53),
    'mallets': ('fga12345', 'F4 G4 A4 Bb4 C5 D5 Eb5 F5', 65, 77),
}
# Independent octave anchors for sounding concert Bb, including octave-transposing tenor.
TONIC = {'flute':70, 'clarinet':58, 'alto':58, 'tenor':58, 'trumpet':58,
         'horn':58, 'trombone':46, 'euphonium':46, 'mallets':70}
OFFSETS = dict(zip('fga12345', (-5, -3, -1, 0, 2, 4, 5, 7)))
MIDDLE = {'horn', 'tenor'}
COMPACT = {'clarinet', 'alto', 'trombone', 'euphonium', 'trumpet'}

middle_jingle = bars('3 3 3h|3 3 3h|1 3 1 2|3w|1 1 1 1|1 1 1 1e 1e|1 2 2 1|2h ah|'
                     '3 3 3h|3 3 3h|1 3 1 2|3w|1 1 1 1|1 1 1 1e 1e|3 3 1 2|1w')
middle_bells = [bar.replace('5', 'f') for bar in bells]
middle_bells[-1] = 'f 0 2 0'
middle_answers = bars('1h 0 1|fh 0 f|1w|0 1 2 3|1h 0 1|1h 0 1|fh 0 f|0 2 0 f|'
                      '1h 0 1|fh 0 f|1w|0 3 2 1|1h 0 1|1h 0 1|3h 2h|1w')
middle_lead = middle_jingle.copy()
middle_lead[3] = middle_lead[11] = '3 0 0h'

# The original tune now sits from the dominant BELOW concert Bb to the third above it.
nicholas = bars('3 3 3 3|2 2 2h|1 1 1 1|3w|g g g g|f f 1h|a 1 2 3|2w|'
                '3 3 3 3|2 2 2h|1 1 1 1|3w|g g g g|f f 1h|2 1 2 3|1w')
compact_nicholas = nicholas.copy()
for start in (4, 12):
    compact_nicholas[start:start+2] = ['4 4 4 4', '3 3 1h']
compact_nicholas[6] = '2 1 2 3'
soft = bars('1w|fw|gw|1h fh|1w|3h 1h|fw|fh ah|' '1w|fw|gw|1h fh|1w|3h 1h|fw|1w')
compact_soft = [bar.replace('f','5').replace('g','4').replace('a','2') for bar in soft]

# In the upper line, use the lower neighbor for the rooftop turn and the root of IV
# for the repeated high sixths. Keep Hanby's rhythm, calls and cadences.
roof = bars('5 5e 4e 5 3e 2e|1 3 5h|4 4 5 3|2 5 5h|5 5e 4e 5 3e 2e|1 3 5h|'
            '4 4e 4e 5e 5e 3e 3e|2 5 1h|4 4 4h|5 5e 5e 3h|2 4 4h|3 5e 5e 1 3|'
            '5 5e 4e 5 3|4 5 4h|5 5e 4e 5 3e 3e|2 5 1h')
middle_roof = bars('f fe ge f 1e ae|1 3 1h|g g 1 3|2 f fh|f fe ge f 1e ae|1 3 1h|'
                   'g ge ge 1e 1e 3e 3e|2 f 1h|g g 1h|1 1e 1e 3h|f g gh|1 1e 1e 1 3|'
                   '1 1e ge 1 3|g f gh|1 1e ge 1 3e 3e|2 f 1h')


def lines_for(pid, index):
    middle = pid in MIDDLE
    if index == 3:
        compact = pid in COMPACT
        tune, support = (compact_nicholas, compact_soft) if compact else (nicholas, soft)
        return tune[:8] + support[8:], support[:8] + tune[8:]
    if index == 4:
        return share(middle_roof if middle else roof, 'AABBBBAA' 'ABABBAXX')
    if not middle:
        return (echo, (jingle[:8] + bells[:7] + ['1 0 1h'], bells + jingle[8:]), (lead, answers))[index]
    if index == 0:
        return share(middle_jingle, 'ABXXAABB' 'BAXXBAXX')
    if index == 1:
        return (middle_jingle[:8] + middle_bells[:7] + ['1 0 1h'], middle_bells + middle_jingle[8:])
    return middle_lead, middle_answers
