"""Encryption utilities for sensitive data"""
from typing import Tuple

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

from wfconsoleweb.config.settings import settings


class EncryptionManager:
    """Manages encryption and decryption of sensitive data like API keys"""

    def __init__(self, master_password: str = None):
        """
        Initialize encryption manager with a master password.

        Args:
            master_password: Password to derive encryption key from. If None, uses settings.
        """
        self.master_password = (
            master_password
            or settings.master_password
            or settings.jwt_secret_key
        )

    def _get_cipher(self) -> Fernet:
        """Generate a Fernet cipher instance from the master password"""
        if not self.master_password:
            raise ValueError(
                "Master password not set. Set MASTER_PASSWORD environment variable "
                "or pass master_password to EncryptionManager."
            )

        # Use PBKDF2 to derive a key from the master password
        salt = b"wfconsole_salt"  # In production, you might want to store salt per user
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(
            kdf.derive(self.master_password.encode())
        )
        return Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext string.

        Args:
            plaintext: The text to encrypt

        Returns:
            Encrypted token string
        """
        cipher = self._get_cipher()
        encrypted = cipher.encrypt(plaintext.encode())
        return encrypted.decode()

    def decrypt(self, encrypted_token: str) -> str:
        """
        Decrypt encrypted token.

        Args:
            encrypted_token: The encrypted token to decrypt

        Returns:
            Decrypted plaintext string
        """
        try:
            cipher = self._get_cipher()
            decrypted = cipher.decrypt(encrypted_token.encode())
            return decrypted.decode()
        except Exception as e:
            raise ValueError(f"Failed to decrypt token: {e}")


# Global encryption manager instance
_encryption_manager = None


def get_encryption_manager(master_password: str = None) -> EncryptionManager:
    """Get or create global encryption manager instance"""
    global _encryption_manager
    if _encryption_manager is None:
        _encryption_manager = EncryptionManager(master_password)
    return _encryption_manager


def encrypt_value(value: str, master_password: str = None) -> str:
    """Convenience function to encrypt a value"""
    manager = get_encryption_manager(master_password)
    return manager.encrypt(value)


def decrypt_value(encrypted: str, master_password: str = None) -> str:
    """Convenience function to decrypt a value"""
    manager = get_encryption_manager(master_password)
    return manager.decrypt(encrypted)
