"""Two-part classroom arrangements. Digits 1–6 mean concert Bb C D Eb F G.
A zero is a rest. Note lengths use the Beginner Pack notation, in 4/4.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Duet:
    title: str
    tempo: int
    cue: str
    a: list
    b: list
    extra_flat: bool = False


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
nicholas = bars('6 6 6 6|5 5 5h|4 4 4 4|6w|2 2 2 2|1 1 4h|3 4 5 6|5w|'
                '6 6 6 6|5 5 5h|4 4 4 4|6w|2 2 2 2|1 1 4h|5 4 5 6|4w')
soft = bars('4w|1w|2w|4h 1h|4w|6h 4h|1w|1w|'
            '4w|1w|2w|4h 1h|4w|6h 4h|1w|4w')
roof = bars('5 5e 6e 5 3e 2e|1 3 5h|6 6 5 3|2 5 5h|5 5e 6e 5 3e 2e|1 3 5h|'
            '6 6e 6e 5e 5e 3e 3e|2 5 1h|4 4 6h|5 5e 5e 3h|2 4 4h|3 5e 5e 1 3|'
            '5 5e 6e 5 3|4 5 6h|5 5e 6e 5 3e 3e|2 5 1h')
roof_roles = share(roof, 'AABBBBAA' 'ABABBAXX')

DUETS = [
    Duet('Jingle Bells · Jingle Bell Echo', 80,
         'A calls in measure 1, B echoes in measure 2. Join on “jingle all the way.”', *echo),
    Duet('Jingle Bells · Sleigh Team', 80,
         'Play the two-note sleigh rhythm lightly. Trade melody and rhythm at measure 9.',
         jingle[:8] + bells[:7] + ['1 0 1h'], bells + jingle[8:]),
    Duet('Jingle Bells · Holiday Duet', 84,
         'A carries the tune. Listen for B’s answers in measures 4 and 12, then land together on the final note.',
         lead, answers),
    Duet('Jolly Old Saint Nicholas', 72,
         'Let the long notes support the melody. B takes the tune in measure 9.',
         nicholas[:8] + soft[8:], soft[:8] + nicholas[8:], True),
    Duet('Up on the Housetop', 80,
         'At measure 9, A calls “Ho, ho, ho!” and B answers “Who wouldn’t go?” Join for the last two bars.',
         *roof_roles)
]
