import base64
from cryptography.fernet import Fernet
from backend.config import settings


def _get_fernet() -> Fernet:
    # Derive a 32-byte URL-safe base64 key from SECRET_KEY
    key_bytes = settings.secret_key.encode().ljust(32)[:32]
    encoded = base64.urlsafe_b64encode(key_bytes)
    return Fernet(encoded)


def encrypt(value: str) -> str:
    if not value:
        return ""
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    if not token:
        return ""
    return _get_fernet().decrypt(token.encode()).decode()
