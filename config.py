import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base config (valori comuni)"""
    SECRET_KEY = os.getenv("SECRET_KEY", "fallback-dev-key")
    FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS")

    DEBUG = False
    TESTING = False


class DevelopmentConfig(Config):
    """Config per sviluppo"""
    DEBUG = True


class ProductionConfig(Config):
    """Config per produzione"""
    DEBUG = False