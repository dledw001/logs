from django import forms
from .models import LogBook, Entry

class LogBookForm(forms.ModelForm):
    class Meta:
        model = LogBook
        fields = ['title', 'description']

class EntryForm(forms.ModelForm):
    class Meta:
        model = Entry
        fields = ['title', 'content', 'occurred_at']
        widgets = {
            "occurred_at": forms.DateTimeInput(attrs={"type": "datetime-local"})
        }