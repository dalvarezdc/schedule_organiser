from backend.crypto import encrypt, decrypt


def test_encrypt_decrypt_roundtrip():
    secret = "my-super-secret-api-key"
    token = encrypt(secret)
    assert token != secret
    assert decrypt(token) == secret


def test_encrypt_empty_string():
    assert decrypt(encrypt("")) == ""
