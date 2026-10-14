"""Regenerate regression fixtures using the preserved independent Python program."""
import json
from math import gcd
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'vendor/two-bridge'))
from two_bridge import branched_surfaces, slopes

pairs = [(p, q) for q in range(3, 62, 2) for p in range(1, q) if gcd(p, q) == 1]
pairs += [(377, 987), (34, 89), (123, 997)]
cases = []
for p, q in pairs:
    surfaces = branched_surfaces(p, q)
    cases.append(dict(p=p, q=q, slopes=slopes(surfaces), surfaceCount=len(surfaces),
                      seifert=next(s.expansion for s in surfaces if all(b % 2 == 0 for b in s.expansion))))
fixture = dict(source='NathanDunfield/montesinos',
               revision='252b55a2ec7f1cc5874416624b01b24ba7299d37', cases=cases)
(ROOT / 'tests/fixtures/boundary-slopes.json').write_text(json.dumps(fixture, separators=(',', ':')) + '\n')
print(f'Wrote {len(cases)} reference cases')
