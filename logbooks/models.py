from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

# from django.contrib.postgres.fields import ArrayField add this if you move to postgres


class LogBook(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="logbooks",
    )
    title = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, blank=True)
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "slug"], name="uniq_logbook_owner_slug"
            )
        ]
        indexes = [
            models.Index(fields=["owner", "slug"], name="idx_logbook_owner_slug")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.owner})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or "logbook"
            slug = base
            i = 2
            while LogBook.objects.filter(
                owner=self.owner, slug=slug
            ).exists():  # ignore warn, created at runtime.
                slug = f"{base}-{i}"
                i += 1
            self.slug = slug
        super().save(*args, **kwargs)


class Entry(models.Model):
    book = models.ForeignKey(LogBook, on_delete=models.CASCADE, related_name="entries")
    occurred_at = models.DateTimeField(default=timezone.now)

    number = models.DecimalField(max_digits=18, decimal_places=3, null=True, blank=True)

    ### number_array = models.ArrayField(
    ### models.DecimalField(max_digits=18, decimal_places=3),
    ### blank=True,
    ### null=True,
    ### default=list
    ###)

    number_array = models.JSONField(blank=True, null=True, default=list)

    short_text = models.CharField(max_length=200, blank=True)
    long_text = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        indexes = [
            models.Index(fields=["book", "occurred_at"], name="idx_entry_book_when"),
        ]

    def __str__(self):
        return f"{self.book.title} @ {self.occurred_at.isoformat()}"
