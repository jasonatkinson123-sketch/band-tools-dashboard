"""Original snare studies. Each cell has one rhythm and one hand per note.
Lowercase = ordinary tap, uppercase = accent, dash = rest. A bare hand is a quarter.
"""
from dataclasses import dataclass


@dataclass
class Lesson:
    title: str
    bpm: int
    count: str
    coach: str
    music: str


LESSONS = [
    Lesson('Keep the pulse', 72, 'Say 1 2 3 4 through every bar, including the silent bar.',
           'R means right hand and L means left. Let each stick rebound. Come back in together on beat 1.',
           'r l r l | r - l - | whole:- | r l r -'),
    Lesson('Two sounds to a beat', 72, 'Say 1 & 2 & 3 & 4 &. Each pair fits inside one foot tap.',
           'Keep the eighth notes just as steady when you switch back to quarters.',
           'r l ee:rl ee:rl | ee:rl ee:rl r l | r ee:lr l ee:rl | ee:rl r l -'),
    Lesson('Four sounds to a beat', 60, 'Say 1 e & a. Four even strokes fill the same space as one quarter.',
           'Keep the sticks low for sixteenths. Check that beat 2 arrives on time.',
           'four:rlrl r l - | r four:lrlr l r | ee:lr ee:lr four:lrlr l | four:rlrl four:rlrl r -'),
    Lesson('Mix the sixteenths', 60, 'For eighth + two sixteenths say 1 & a. For two sixteenths + eighth say 1 e &.',
           'In the middle pattern, play 1 e a. Keep counting all four slots in your head.',
           'ess:rlr l ess:rlr l | sse:rlr l sse:rlr l | ses:rlr l ses:rlr l | ess:rlr sse:lrl ses:rlr l'),
    Lesson('Enter on the offbeat', 68, 'Count 1 & 2 &. In bar 1, leave beat 1 silent and play on its &.',
           'In bar 3, the quarter starts on the & of 1. Keep your foot on the numbered beats.',
           'ee:-r l ee:-r l | r ee:-l ee:r- l | sync:rlr sync:lrl | ee:-r ee:-l r -'),
    Lesson('The dotted eighth', 64, 'Count 1 e & a. The dotted eighth takes three slots. Play again on a.',
           'Compare the dotted pair with two even eighths. Listen for the short last stroke.',
           'dot:rl r dot:lr l | ee:rl dot:rl ee:rl dot:rl | dot:rl ess:rlr dot:lr l | dot:rl dot:rl r -'),
    Lesson('Accents and dynamics', 72, 'Keep saying 1 & 2 &. The accents change hands without changing the pulse.',
           'p means soft and f means loud. The > marks one stronger stroke. Let the surrounding taps stay low.',
           'p ee:Rl ee:rL ee:Rl ee:rL | ee:rL ee:Rl r l | f ee:Rl ee:rL ee:Rl ee:rL | p ee:Rl ee:rL R -'),
    Lesson('Double strokes', 64, 'Say 1 e & a as R R L L. Give the two strokes on each hand equal space.',
           'Start with slow pairs of eighths. Use two controlled strokes before you try adding speed.',
           'ee:rr ee:ll ee:rr ee:ll | four:rrll r l - | four:llrr l r - | four:rrll four:rrll r -'),
    Lesson('Single paradiddle', 64, 'Say pa-ra-did-dle. Play R L R R, then L R L L.',
           'Accent the first stroke of each group. The double at the end frees the other hand to lead.',
           'four:Rlrr four:Lrll r l | four:Lrll four:Rlrr l r | four:Rlrr four:Lrll four:Rlrr four:Lrll | R - L -'),
    Lesson('Flams', 64, 'Count the large note on the beat. The small grace note sounds just before it.',
           'Start one stick low and the other higher. A small l before R is a right flam. Reverse for a left flam.',
           '- flam:r - flam:l | r flam:l l flam:r | - flam:r ee:lr flam:l | r l flam:R -'),
    Lesson('Five-stroke roll', 64, 'Count 1 e & a TWO. The five strokes are R R L L R, then rest.',
           'The two doubles lead into one accented release on the next beat. Reverse the hands in bar 2.',
           'four:rrll R - - | four:llrr L - - | four:rrll R four:llrr L | four:rrll R ee:lr L'),
    Lesson('Concert buzz roll', 68, 'In bar 1, start rolling on 1, sustain through 2, and release with one tap on 3.',
           'The slashes mark a roll. Alternate hands, letting each stick bounce several times. Overlap the buzzes for an even sound.',
           'buzz:r R - | buzz:l L - | r shortbuzz:l R - | buzz:r L -'),
    Lesson('Three in a beat', 66, 'Say 1-trip-let, 2-trip-let. All three notes in the bracket fit inside one beat.',
           'Compare two, three, and four strokes per beat. Keep the foot moving at the same speed.',
           'trip:rlr trip:lrl r l | ee:rl trip:rlr l - | trip:lrl four:rlrl r l | ee:rl trip:rlr four:lrlr L'),
    Lesson('Downbeat March', 80, 'Count four through the entire study. In bar 7, sustain the roll through beat 2.',
           'Start under tempo. Keep the quiet flams close, shape the loud answer, and place the last accent exactly on beat 3.',
           'mf R ee:lr ess:lrl R | dot:lr l ee:-r L | p r flam:l four:Rlrr four:Lrll | sync:rlr r - | '
           'f four:rrll R sse:lrl R | trip:lrl ee:rl dot:rl R | p buzz:r L ee:rl | mf four:Rlrr four:Lrll R -')
]
