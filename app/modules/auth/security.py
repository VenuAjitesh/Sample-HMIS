import hashlib
import hmac
import secrets

SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def derive(password, salt):
    return hashlib.scrypt(password.encode(), salt=salt, **SCRYPT)


def hash_password(password):
    salt = secrets.token_bytes(16)
    return f"scrypt${salt.hex()}${derive(password, salt).hex()}"


def verify_password(password, stored):
    try:
        _, salt, digest = stored.split("$")
    except ValueError:
        return False
    return hmac.compare_digest(derive(password, bytes.fromhex(salt)).hex(), digest)


def new_token():
    return secrets.token_urlsafe(32)


def digest_token(token):
    return hashlib.sha256(token.encode()).hexdigest()
