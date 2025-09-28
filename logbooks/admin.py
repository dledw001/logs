from django.contrib import admin
from .models import LogBook, Entry

@admin.register(LogBook)
class LogBookAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "created_at")
    search_fields = ("title", "owner__username", "owner__email")
    list_filter = ("owner",)
    prepopulated_fields = {"slug": ("title",)}  # optional; save() also auto-slugs

@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = ("book", "title", "occurred_at", "created_at")
    search_fields = ("title", "content", "book__title", "book__owner__username")
    list_filter = ("book",)
