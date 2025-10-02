from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Drop-in replacement for auth.User (username + email). Add fields later."""

    pass
