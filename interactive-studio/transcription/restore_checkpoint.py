"""Usage: python restore_checkpoint.py checkpoint.aes256.b64 recovery.key recovered.zip"""
import sys,base64
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
archive,key,destination=map(Path,sys.argv[1:])
ciphertext=base64.b64decode(archive.read_bytes())
payload=AESGCM(key.read_bytes()).decrypt(ciphertext[:12],ciphertext[12:],None)
with destination.open('xb') as output:output.write(payload)
